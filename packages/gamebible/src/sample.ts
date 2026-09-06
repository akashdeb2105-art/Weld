import type { GameBible } from './index';
import raw from './scrap-sprint.gamebible.json';

/**
 * The canonical deterministic sample GameBible ("Scrap Sprint"), typed and
 * shipped with the package so runtimes (the sample game, the web app) can
 * import it without reaching across package boundaries into a JSON file.
 * It is NOT parsed here — callers validate with `parseGameBible` at the
 * trust boundary.
 */
export const sampleBible = raw as unknown as GameBible;
export default sampleBible;
