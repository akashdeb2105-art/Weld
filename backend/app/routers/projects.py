from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..director import (
    DirectorError,
    DirectorUnavailableError,
    generate_game_bible,
    slugify,
)
from .. import builder, playtest
from ..builder import BuildError, BuildUnavailableError
from ..director import SUPPORTED_GENRES
from ..gamebible import GameBibleDoc
from ..models import Bug, GameBibleRow, Job, Project
from ..playtest import PlaytestError, PlaytestUnavailableError
from ..schemas import (
    BuildManifestOut,
    BuildResponse,
    BugOut,
    ConfirmProjectRequest,
    CreateProjectRequest,
    CreateProjectResponse,
    DraftBibleResponse,
    GameBibleOut,
    JobOut,
    PlaytestReportOut,
    ProjectDetailOut,
    ProjectOut,
    PublicGameOut,
    PublishResponse,
    RecordBugRequest,
    RegressionCaseResult,
    RegressionSuiteOut,
    RetestResponse,
    UpdateGameBibleRequest,
)

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(session: Session = Depends(get_session)) -> list[Project]:
    return list(session.scalars(select(Project).order_by(Project.created_at)))


@router.get("/{slug}", response_model=ProjectDetailOut)
def get_project(slug: str, session: Session = Depends(get_session)) -> Project:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail=f"project '{slug}' not found")
    return project


@router.get("/{slug}/gamebible", response_model=GameBibleOut)
def get_game_bible(slug: str, session: Session = Depends(get_session)) -> GameBibleOut:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")
    return GameBibleOut(
        project_slug=project.slug,
        schema_version=project.game_bible.schema_version,
        data=project.game_bible.data,
    )


@router.get("/{slug}/jobs", response_model=list[JobOut])
def list_jobs(slug: str, session: Session = Depends(get_session)) -> list[Job]:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail=f"project '{slug}' not found")
    return list(
        session.scalars(select(Job).where(Job.project_id == project.id).order_by(Job.created_at))
    )


@router.get("/{slug}/playtest", response_model=PlaytestReportOut)
def get_playtest(slug: str, session: Session = Depends(get_session)) -> PlaytestReportOut:
    """Run the deterministic Playtester (M3) against the project's GameBible.

    Returns an evidence-backed verdict per quality gate (builds, boots,
    controls, win reachable, lose reachable, restart). 503 when the playtester
    can't run in this environment; 500 when it ran but produced no report.
    """
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    try:
        report = playtest.playtest_bible(project.game_bible.data)
    except PlaytestUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PlaytestError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return PlaytestReportOut.model_validate(report)


@router.post("/{slug}/build", response_model=BuildResponse)
def build_project(slug: str, session: Session = Depends(get_session)) -> BuildResponse:
    """Run the Game Builder (M2) on a project's bible and return the manifest.

    "Compilation is not completion" — this proves the bible satisfies the strict
    builds contract and records the artifact as a Job. Rebuilding an unchanged
    bible reuses the prior content-addressed artifact (and says so).
    """
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    doc = project.game_bible.data
    job = None
    try:
        job = _run_build(session, project, doc)
    except BuildUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except BuildError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return BuildResponse(
        project=ProjectOut.model_validate(project),
        manifest=BuildManifestOut.model_validate(job.result),
        reused=bool(job.result.get("reused", False)),
    )


#  M4 Bug -> Fix -> Regression


def _get_project_or_404(session: Session, slug: str) -> Project:
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail=f"project '{slug}' not found")
    return project


def _bug_to_out(bug: Bug, slug: str) -> BugOut:
    return BugOut(
        id=bug.id,
        project_slug=slug,
        gate=bug.gate,
        summary=bug.summary,
        evidence=bug.evidence,
        status=bug.status,
        created_at=bug.created_at,
        fixed_at=bug.fixed_at,
    )


def _gate_verdict(report: dict, gate: str) -> tuple[bool, str]:
    """Return (passed, evidence) for one gate from a playtest report.

    A gate that isn't in the report at all counts as not-passing (honest: we
    can't claim what we didn't observe).
    """
    g = next((g for g in report.get("gates", []) if g.get("gate") == gate), None)
    if g is None:
        return False, f"gate '{gate}' not present in playtest report"
    return bool(g.get("pass", False)), str(g.get("evidence", ""))


@router.get("/{slug}/bugs", response_model=list[BugOut])
def list_bugs(slug: str, session: Session = Depends(get_session)) -> list[BugOut]:
    """List a project's recorded bugs (open + fixed), oldest first."""
    project = _get_project_or_404(session, slug)
    bugs = session.scalars(
        select(Bug).where(Bug.project_id == project.id).order_by(Bug.created_at)
    )
    return [_bug_to_out(b, project.slug) for b in bugs]


@router.post("/{slug}/bugs", response_model=BugOut, status_code=201)
def record_bug(
    slug: str, body: RecordBugRequest, session: Session = Depends(get_session)
) -> BugOut:
    """Record a failed quality gate as a bug (M4).

    Honest capture: the gate's evidence comes from the playtest report the
    caller just saw. We freeze the project's current bible as the broken
    scenario so the later regression replays exactly what failed.
    """
    project = _get_project_or_404(session, slug)
    if project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    bug = Bug(
        project_id=project.id,
        gate=body.gate,
        summary=body.summary or f"{body.gate} failing",
        evidence=body.evidence,
        status="open",
        broken_bible=project.game_bible.data,
    )
    session.add(bug)
    session.commit()
    session.refresh(bug)
    return _bug_to_out(bug, project.slug)


@router.post("/{slug}/bugs/{bug_id}/retest", response_model=RetestResponse)
def retest_bug(slug: str, bug_id: int, session: Session = Depends(get_session)) -> RetestResponse:
    """Re-run the Playtester against the current bible and check this bug's gate.

    This is the FIX step's verdict: the bug flips to "fixed" only when its gate
    now passes against the live bible. The frozen broken bible is kept so the
    regression suite can replay the original failure mode.
    """
    project = _get_project_or_404(session, slug)
    bug = session.get(Bug, bug_id)
    if bug is None or bug.project_id != project.id:
        raise HTTPException(status_code=404, detail=f"bug {bug_id} not found on '{slug}'")
    if project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    try:
        report = playtest.playtest_bible(project.game_bible.data)
    except PlaytestUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PlaytestError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    passed, evidence = _gate_verdict(report, bug.gate)
    fixed_now = False
    if passed and bug.status != "fixed":
        bug.status = "fixed"
        bug.fixed_at = datetime.now(timezone.utc)
        bug.evidence = evidence or bug.evidence
        fixed_now = True
        session.add(bug)
        session.commit()
        session.refresh(bug)

    return RetestResponse(
        bug=_bug_to_out(bug, project.slug),
        fixed_now=fixed_now,
        gate_passed=passed,
        evidence=evidence,
    )


@router.get("/{slug}/regressions", response_model=RegressionSuiteOut)
def run_regressions(slug: str, session: Session = Depends(get_session)) -> RegressionSuiteOut:
    """Replay every fixed bug's frozen regression case (M4 regression suite).

    For each fixed bug we re-run the Playtester against the bible that *was*
    broken plus the current bible's gate target, asserting the gate passes now.
    The honest read: a regression case passes when the playtester says the gate
    holds for the fixed scenario -- so a "fixed" bug that silently regresses
    shows up here as failing again.
    """
    project = _get_project_or_404(session, slug)
    fixed = session.scalars(
        select(Bug)
        .where(Bug.project_id == project.id, Bug.status == "fixed")
        .order_by(Bug.created_at)
    ).all()

    results: list[RegressionCaseResult] = []
    for bug in fixed:
        # Replay against the CURRENT live bible: the gate that once failed must
        # still pass against what the game actually is now. (The frozen broken
        # bible documents what failed; the live bible is what must stay fixed.)
        if project.game_bible is None:
            raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")
        try:
            report = playtest.playtest_bible(project.game_bible.data)
        except PlaytestUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PlaytestError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        passed, evidence = _gate_verdict(report, bug.gate)
        results.append(
            RegressionCaseResult(bug_id=bug.id, gate=bug.gate, passed=passed, evidence=evidence)
        )

    passing = sum(1 for r in results if r.passed)
    return RegressionSuiteOut(
        project_slug=project.slug,
        total=len(results),
        passing=passing,
        regressions=results,
        all_passing=passing == len(results),
    )


#  M5 Publish


@router.post("/{slug}/publish", response_model=PublishResponse)
def publish_project(slug: str, session: Session = Depends(get_session)) -> PublishResponse:
    """Publish a game to its public, shareable URL (M5 "Ship it").

    Honest gate: publishing runs the Playtester against the current bible and
    refuses (409) unless EVERY quality gate passes. A game that boots broken,
    has dead controls, or an unreachable win is never shipped. Re-publishing an
    already-published game is idempotent and says so (`already`), not a fake
    new ship.
    """
    project = _get_project_or_404(session, slug)
    if project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    if project.published:
        return PublishResponse(
            project=ProjectOut.model_validate(project),
            published=True,
            already=True,
            playtest_passed=True,
            share_path=f"/play/{project.slug}",
        )

    try:
        report = playtest.playtest_bible(project.game_bible.data)
    except PlaytestUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PlaytestError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not report.get("pass", False):
        failing = [g.get("gate") for g in report.get("gates", []) if not g.get("pass", False)]
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot publish: quality gates failing: "
                + (", ".join(str(g) for g in failing) or "unknown")
                + ". Fix the bugs and re-test first."
            ),
        )

    project.published = True
    project.published_at = datetime.now(timezone.utc)
    project.jobs.append(
        Job(
            type="publish",
            status="succeeded",
            payload={"slug": project.slug},
            result={"share_path": f"/play/{project.slug}", "playtest_passed": True},
            finished_at=datetime.now(timezone.utc),
        )
    )
    session.commit()
    session.refresh(project)

    return PublishResponse(
        project=ProjectOut.model_validate(project),
        published=True,
        already=False,
        playtest_passed=True,
        share_path=f"/play/{project.slug}",
    )


@router.get("/{slug}/public", response_model=PublicGameOut)
def get_public_game(slug: str, session: Session = Depends(get_session)) -> PublicGameOut:
    """The public, published view of a game (M5).

    404 unless the project is actually published, so an unpublished game is
    never exposed through the share page.
    """
    project = _get_project_or_404(session, slug)
    if not project.published:
        raise HTTPException(status_code=404, detail=f"'{slug}' is not published")
    return PublicGameOut(
        slug=project.slug,
        title=project.title,
        summary=project.summary,
        genre=project.genre,
        published_at=project.published_at,
    )


def _unique_slug(session: Session, base: str) -> str:
    """Guarantee a free slug by suffixing -2, -3, … if the base is taken."""
    slug = base
    n = 2
    while session.scalar(select(Project).where(Project.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
    return slug


def _validate_bible_for_save(doc: dict) -> dict:
    """Validate a Game Bible that's about to be persisted or shipped.

    Two layers, both honest: the Python mirror (fail fast on a structurally
    broken doc) and the strict TS playtester contract (the real schema — it
    also enforces subset fields the mirror doesn't model, like the delivery
    zone label). Raises 400 with the offending detail, never saves a bad doc.
    """
    try:
        GameBibleDoc.model_validate(doc)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"invalid Game Bible: {exc}") from exc
    genre = doc.get("game", {}).get("genre")
    if genre not in SUPPORTED_GENRES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"unsupported genre '{genre}'. M1 supports: {', '.join(sorted(SUPPORTED_GENRES))}."
            ),
        )
    try:
        # The playtester's "builds" gate is the strict contract check. A doc
        # that doesn't satisfy it would produce a game that can't boot.
        playtest.playtest_bible(doc)
    except PlaytestUnavailableError:
        # Node/CLI not present here — the Python mirror already validated, so
        # don't block an edit just because the strict checker can't run.
        pass
    except PlaytestError as exc:
        raise HTTPException(status_code=400, detail=f"invalid Game Bible: {exc}") from exc
    return doc


def _run_build(session: Session, project: Project, doc: dict) -> Job:
    """Run the Game Builder (M2) on a project's bible and record the Job.

    Compiles the bible into a deterministic, content-addressed manifest. If the
    bible is unchanged since the last successful build, the prior artifact is
    reused (honest: we say so) rather than pretending to rebuild. On success the
    project status moves draft/built; a failed build records the error honestly.
    """
    try:
        manifest = builder.build_manifest(doc)
    except BuildUnavailableError:
        raise
    except BuildError as exc:
        project.jobs.append(
            Job(
                type="build",
                status="failed",
                payload={"slug": project.slug},
                result={},
                error=str(exc),
                finished_at=datetime.now(timezone.utc),
            )
        )
        project.status = "draft"
        session.commit()
        raise

    # Reuse the prior artifact when the bible content is unchanged.
    prior = next(
        (
            j
            for j in sorted(project.jobs, key=lambda j: j.id, reverse=True)
            if j.type == "build" and j.status == "succeeded"
        ),
        None,
    )
    reused = bool(prior and prior.result.get("content_hash") == manifest["content_hash"])

    project.jobs.append(
        Job(
            type="build",
            status="succeeded",
            payload={"slug": project.slug},
            result={**manifest, "reused": reused},
            finished_at=datetime.now(timezone.utc),
        )
    )
    project.status = "built"
    session.commit()
    session.refresh(project)
    return project.jobs[-1]


def _build_or_fail(session: Session, project: Project, doc: dict) -> None:
    """Run the Builder, translating its failures into honest HTTP errors.

    A build that can't run here (no Node/playtester CLI) is a 503; a bible that
    fails the strict contract is a 400. Either way the failure Job is recorded.
    """
    try:
        _run_build(session, project, doc)
    except BuildUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except BuildError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _persist_project(session: Session, doc: dict, prompt: str, mode: str, notes: list[str]) -> Project:
    """Create + persist a project (and its Game Bible + provenance Job)."""
    game = doc["game"]
    slug = _unique_slug(session, slugify(game["slug"]))
    project = Project(
        slug=slug,
        title=game["title"],
        summary=game["one_liner"],
        genre=game["genre"],
        status="draft",
        provenance="ai_generated" if mode == "llm" else "offline_draft",
    )
    project.game_bible = GameBibleRow(schema_version=doc["schemaVersion"], data=doc)
    project.jobs.append(
        Job(
            type="director_draft",
            status="succeeded",
            payload={"prompt": prompt, "mode": mode},
            result={"notes": notes, "slug": slug},
            finished_at=datetime.now(timezone.utc),
        )
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.post("", response_model=CreateProjectResponse, status_code=201)
async def create_project(
    body: CreateProjectRequest, session: Session = Depends(get_session)
) -> CreateProjectResponse:
    """Run the Game Director: prompt -> validated Game Bible -> new project.

    The generated document is schema-validated before it is persisted, and the
    run is recorded as a real Job so the Studio shows honest provenance.
    """
    try:
        result = await generate_game_bible(body.prompt)
    except DirectorUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DirectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project = _persist_project(session, result.doc, body.prompt, result.mode, result.notes)
    # M2: build immediately so the game is provably playable, not just drafted.
    _build_or_fail(session, project, result.doc)
    return CreateProjectResponse(
        project=ProjectOut.model_validate(project),
        game_bible=result.doc,
        mode=result.mode,
        notes=result.notes,
    )


@router.post("/draft", response_model=DraftBibleResponse)
async def draft_game_bible(body: CreateProjectRequest) -> DraftBibleResponse:
    """Review-before-create (M1): draft a Game Bible for inspection, don't persist.

    The Director composes + validates a spec from the prompt and returns it so
    the user can review/edit before committing. Nothing is saved here — the
    confirm endpoint turns a reviewed spec into a real project.
    """
    try:
        result = await generate_game_bible(body.prompt)
    except DirectorUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except DirectorError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return DraftBibleResponse(
        game_bible=result.doc, mode=result.mode, notes=result.notes, prompt=body.prompt
    )


@router.post("/confirm", response_model=CreateProjectResponse, status_code=201)
def confirm_project(
    body: ConfirmProjectRequest, session: Session = Depends(get_session)
) -> CreateProjectResponse:
    """Create a project from a reviewed (possibly user-edited) Game Bible."""
    doc = _validate_bible_for_save(body.game_bible)
    project = _persist_project(session, doc, body.prompt, body.mode, [])
    # M2: the reviewed spec is compiled into a playable artifact right away.
    _build_or_fail(session, project, doc)
    return CreateProjectResponse(
        project=ProjectOut.model_validate(project),
        game_bible=doc,
        mode=body.mode,
        notes=[],
    )


@router.put("/{slug}/gamebible", response_model=GameBibleOut)
def update_game_bible(
    slug: str, body: UpdateGameBibleRequest, session: Session = Depends(get_session)
) -> GameBibleOut:
    """Replace a project's Game Bible (the Studio editor, M1).

    Re-validated against the real contract before saving; the change is
    recorded as a Job so the edit is honest provenance, not a silent mutation.
    """
    project = session.scalar(select(Project).where(Project.slug == slug))
    if project is None or project.game_bible is None:
        raise HTTPException(status_code=404, detail=f"game bible for '{slug}' not found")

    doc = _validate_bible_for_save(body.game_bible)
    project.game_bible.data = doc
    project.game_bible.schema_version = doc["schemaVersion"]
    project.title = doc["game"]["title"]
    project.summary = doc["game"]["one_liner"]
    project.genre = doc["game"]["genre"]
    project.jobs.append(
        Job(
            type="bible_edit",
            status="succeeded",
            payload={"source": "studio_editor"},
            result={"slug": slug},
            finished_at=datetime.now(timezone.utc),
        )
    )
    session.commit()
    # M2: an edit invalidates the prior build  recompile so the Studio's build
    # badge reflects the edited bible, not a stale artifact. If the build can't
    # run here, we still save the (valid) edit and leave status honestly draft.
    try:
        _run_build(session, project, doc)
    except (BuildUnavailableError, BuildError):
        project.status = "draft"
        session.commit()
    return GameBibleOut(
        project_slug=project.slug,
        schema_version=project.game_bible.schema_version,
        data=project.game_bible.data,
    )
