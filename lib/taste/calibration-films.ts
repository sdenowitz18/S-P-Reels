/**
 * Calibration film set for the cold-start Taste Setup flow.
 *
 * 36 well-known films spanning all 12 cinematic dimensions.
 * Film IDs use the system's `movie-{tmdb_id}` format.
 * dimensions_v2 values are hardcoded (0–100 per dimension) so the
 * taste code algorithm can run without database enrichment.
 *
 * Dimension scale reference (0 = left pole, 100 = right pole):
 *   narrative_legibility:     0=clear ↔ 100=opaque
 *   emotional_directness:     0=vivid/guided ↔ 100=subtle/restrained
 *   plot_vs_character:        0=plot ↔ 100=character
 *   naturalistic_vs_stylized: 0=naturalistic ↔ 100=stylized/theatrical
 *   narrative_closure:        0=resolves ↔ 100=deliberately open
 *   intimate_vs_epic:         0=intimate ↔ 100=epic
 *   accessible_vs_demanding:  0=accessible ↔ 100=demanding
 *   psychological_safety:     0=reassuring ↔ 100=disturbing
 *   moral_clarity:            0=clear good/evil ↔ 100=morally ambiguous
 *   behavioral_realism:       0=psychologically real ↔ 100=archetypal
 *   sensory_vs_intellectual:  0=sensory/visceral ↔ 100=intellectual
 *   kinetic_vs_patient:       0=kinetic/fast ↔ 100=patient/slow
 */

import { FilmDimensionsV2 } from '../prompts/film-brief'

export interface CalibrationFilm {
  tmdb_id:   string   // format: "movie-{id}"
  title:     string
  year:      number
  dimensions_v2: FilmDimensionsV2
}

export const CALIBRATION_FILMS: CalibrationFilm[] = [

  // ── narrative_legibility ─────────────────────────────────────────────────
  {
    tmdb_id: 'movie-329', title: 'Jurassic Park', year: 1993,
    dimensions_v2: { narrative_legibility: 12, emotional_directness: 28, plot_vs_character: 22,
      naturalistic_vs_stylized: 55, narrative_closure: 18, intimate_vs_epic: 75,
      accessible_vs_demanding: 10, psychological_safety: 45, moral_clarity: 22,
      behavioral_realism: 42, sensory_vs_intellectual: 30, kinetic_vs_patient: 22 },
  },
  {
    tmdb_id: 'movie-1018', title: 'Mulholland Drive', year: 2001,
    dimensions_v2: { narrative_legibility: 90, emotional_directness: 72, plot_vs_character: 65,
      naturalistic_vs_stylized: 70, narrative_closure: 92, intimate_vs_epic: 28,
      accessible_vs_demanding: 85, psychological_safety: 82, moral_clarity: 82,
      behavioral_realism: 68, sensory_vs_intellectual: 48, kinetic_vs_patient: 62 },
  },
  {
    tmdb_id: 'movie-680', title: 'Pulp Fiction', year: 1994,
    dimensions_v2: { narrative_legibility: 45, emotional_directness: 40, plot_vs_character: 45,
      naturalistic_vs_stylized: 72, narrative_closure: 62, intimate_vs_epic: 32,
      accessible_vs_demanding: 42, psychological_safety: 65, moral_clarity: 82,
      behavioral_realism: 60, sensory_vs_intellectual: 35, kinetic_vs_patient: 28 },
  },

  // ── emotional_directness ─────────────────────────────────────────────────
  {
    tmdb_id: 'movie-424', title: "Schindler's List", year: 1993,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 10, plot_vs_character: 52,
      naturalistic_vs_stylized: 22, narrative_closure: 28, intimate_vs_epic: 55,
      accessible_vs_demanding: 38, psychological_safety: 78, moral_clarity: 18,
      behavioral_realism: 22, sensory_vs_intellectual: 38, kinetic_vs_patient: 45 },
  },
  {
    tmdb_id: 'movie-1063148', title: 'Aftersun', year: 2022,
    dimensions_v2: { narrative_legibility: 62, emotional_directness: 90, plot_vs_character: 82,
      naturalistic_vs_stylized: 18, narrative_closure: 80, intimate_vs_epic: 12,
      accessible_vs_demanding: 68, psychological_safety: 72, moral_clarity: 65,
      behavioral_realism: 18, sensory_vs_intellectual: 38, kinetic_vs_patient: 75 },
  },
  {
    tmdb_id: 'movie-597', title: 'Titanic', year: 1997,
    dimensions_v2: { narrative_legibility: 10, emotional_directness: 10, plot_vs_character: 35,
      naturalistic_vs_stylized: 50, narrative_closure: 25, intimate_vs_epic: 88,
      accessible_vs_demanding: 8, psychological_safety: 45, moral_clarity: 18,
      behavioral_realism: 45, sensory_vs_intellectual: 22, kinetic_vs_patient: 28 },
  },

  // ── plot_vs_character ────────────────────────────────────────────────────
  {
    tmdb_id: 'movie-76341', title: 'Mad Max: Fury Road', year: 2015,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 32, plot_vs_character: 15,
      naturalistic_vs_stylized: 80, narrative_closure: 22, intimate_vs_epic: 85,
      accessible_vs_demanding: 18, psychological_safety: 55, moral_clarity: 22,
      behavioral_realism: 72, sensory_vs_intellectual: 15, kinetic_vs_patient: 8 },
  },
  {
    tmdb_id: 'movie-209112', title: 'Boyhood', year: 2014,
    dimensions_v2: { narrative_legibility: 32, emotional_directness: 55, plot_vs_character: 90,
      naturalistic_vs_stylized: 12, narrative_closure: 62, intimate_vs_epic: 18,
      accessible_vs_demanding: 52, psychological_safety: 52, moral_clarity: 55,
      behavioral_realism: 12, sensory_vs_intellectual: 55, kinetic_vs_patient: 78 },
  },
  {
    tmdb_id: 'movie-376867', title: 'Moonlight', year: 2016,
    dimensions_v2: { narrative_legibility: 28, emotional_directness: 82, plot_vs_character: 88,
      naturalistic_vs_stylized: 18, narrative_closure: 62, intimate_vs_epic: 10,
      accessible_vs_demanding: 62, psychological_safety: 68, moral_clarity: 60,
      behavioral_realism: 15, sensory_vs_intellectual: 40, kinetic_vs_patient: 72 },
  },

  // ── naturalistic_vs_stylized ─────────────────────────────────────────────
  {
    tmdb_id: 'movie-334541', title: 'Manchester by the Sea', year: 2016,
    dimensions_v2: { narrative_legibility: 32, emotional_directness: 80, plot_vs_character: 78,
      naturalistic_vs_stylized: 10, narrative_closure: 70, intimate_vs_epic: 12,
      accessible_vs_demanding: 52, psychological_safety: 82, moral_clarity: 65,
      behavioral_realism: 10, sensory_vs_intellectual: 50, kinetic_vs_patient: 68 },
  },
  {
    tmdb_id: 'movie-120467', title: 'The Grand Budapest Hotel', year: 2014,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 42, plot_vs_character: 42,
      naturalistic_vs_stylized: 90, narrative_closure: 28, intimate_vs_epic: 42,
      accessible_vs_demanding: 28, psychological_safety: 48, moral_clarity: 38,
      behavioral_realism: 80, sensory_vs_intellectual: 42, kinetic_vs_patient: 32 },
  },
  {
    tmdb_id: 'movie-129', title: 'Spirited Away', year: 2001,
    dimensions_v2: { narrative_legibility: 42, emotional_directness: 25, plot_vs_character: 52,
      naturalistic_vs_stylized: 85, narrative_closure: 30, intimate_vs_epic: 60,
      accessible_vs_demanding: 25, psychological_safety: 35, moral_clarity: 28,
      behavioral_realism: 82, sensory_vs_intellectual: 30, kinetic_vs_patient: 32 },
  },

  // ── narrative_closure ────────────────────────────────────────────────────
  {
    tmdb_id: 'movie-278', title: 'The Shawshank Redemption', year: 1994,
    dimensions_v2: { narrative_legibility: 10, emotional_directness: 18, plot_vs_character: 52,
      naturalistic_vs_stylized: 25, narrative_closure: 10, intimate_vs_epic: 35,
      accessible_vs_demanding: 10, psychological_safety: 22, moral_clarity: 10,
      behavioral_realism: 42, sensory_vs_intellectual: 38, kinetic_vs_patient: 50 },
  },
  {
    tmdb_id: 'movie-429422', title: 'No Country for Old Men', year: 2007,
    dimensions_v2: { narrative_legibility: 52, emotional_directness: 65, plot_vs_character: 52,
      naturalistic_vs_stylized: 28, narrative_closure: 88, intimate_vs_epic: 55,
      accessible_vs_demanding: 60, psychological_safety: 85, moral_clarity: 90,
      behavioral_realism: 32, sensory_vs_intellectual: 60, kinetic_vs_patient: 65 },
  },
  {
    tmdb_id: 'movie-38142', title: 'Eternal Sunshine of the Spotless Mind', year: 2004,
    dimensions_v2: { narrative_legibility: 58, emotional_directness: 35, plot_vs_character: 72,
      naturalistic_vs_stylized: 68, narrative_closure: 55, intimate_vs_epic: 15,
      accessible_vs_demanding: 48, psychological_safety: 50, moral_clarity: 60,
      behavioral_realism: 45, sensory_vs_intellectual: 50, kinetic_vs_patient: 42 },
  },

  // ── intimate_vs_epic ─────────────────────────────────────────────────────
  {
    tmdb_id: 'movie-492188', title: 'Marriage Story', year: 2019,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 22, plot_vs_character: 75,
      naturalistic_vs_stylized: 28, narrative_closure: 42, intimate_vs_epic: 10,
      accessible_vs_demanding: 32, psychological_safety: 55, moral_clarity: 65,
      behavioral_realism: 15, sensory_vs_intellectual: 50, kinetic_vs_patient: 55 },
  },
  {
    tmdb_id: 'movie-274', title: 'Lawrence of Arabia', year: 1962,
    dimensions_v2: { narrative_legibility: 28, emotional_directness: 50, plot_vs_character: 55,
      naturalistic_vs_stylized: 55, narrative_closure: 42, intimate_vs_epic: 95,
      accessible_vs_demanding: 65, psychological_safety: 55, moral_clarity: 60,
      behavioral_realism: 42, sensory_vs_intellectual: 55, kinetic_vs_patient: 62 },
  },
  {
    tmdb_id: 'movie-238', title: 'The Godfather', year: 1972,
    dimensions_v2: { narrative_legibility: 20, emotional_directness: 42, plot_vs_character: 60,
      naturalistic_vs_stylized: 40, narrative_closure: 38, intimate_vs_epic: 78,
      accessible_vs_demanding: 35, psychological_safety: 52, moral_clarity: 45,
      behavioral_realism: 55, sensory_vs_intellectual: 45, kinetic_vs_patient: 58 },
  },

  // ── accessible_vs_demanding ──────────────────────────────────────────────
  {
    tmdb_id: 'movie-299534', title: 'Avengers: Endgame', year: 2019,
    dimensions_v2: { narrative_legibility: 12, emotional_directness: 18, plot_vs_character: 22,
      naturalistic_vs_stylized: 65, narrative_closure: 12, intimate_vs_epic: 92,
      accessible_vs_demanding: 8, psychological_safety: 38, moral_clarity: 18,
      behavioral_realism: 78, sensory_vs_intellectual: 18, kinetic_vs_patient: 15 },
  },
  {
    tmdb_id: 'movie-72976', title: 'The Tree of Life', year: 2011,
    dimensions_v2: { narrative_legibility: 82, emotional_directness: 62, plot_vs_character: 72,
      naturalistic_vs_stylized: 62, narrative_closure: 85, intimate_vs_epic: 68,
      accessible_vs_demanding: 90, psychological_safety: 55, moral_clarity: 68,
      behavioral_realism: 48, sensory_vs_intellectual: 58, kinetic_vs_patient: 90 },
  },
  {
    tmdb_id: 'movie-497582', title: 'Roma', year: 2018,
    dimensions_v2: { narrative_legibility: 38, emotional_directness: 75, plot_vs_character: 85,
      naturalistic_vs_stylized: 12, narrative_closure: 65, intimate_vs_epic: 22,
      accessible_vs_demanding: 78, psychological_safety: 68, moral_clarity: 55,
      behavioral_realism: 12, sensory_vs_intellectual: 32, kinetic_vs_patient: 85 },
  },

  // ── psychological_safety ─────────────────────────────────────────────────
  {
    tmdb_id: 'movie-313369', title: 'La La Land', year: 2016,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 15, plot_vs_character: 52,
      naturalistic_vs_stylized: 75, narrative_closure: 50, intimate_vs_epic: 22,
      accessible_vs_demanding: 18, psychological_safety: 28, moral_clarity: 32,
      behavioral_realism: 55, sensory_vs_intellectual: 25, kinetic_vs_patient: 32 },
  },
  {
    tmdb_id: 'movie-493922', title: 'Hereditary', year: 2018,
    dimensions_v2: { narrative_legibility: 55, emotional_directness: 28, plot_vs_character: 55,
      naturalistic_vs_stylized: 55, narrative_closure: 48, intimate_vs_epic: 25,
      accessible_vs_demanding: 55, psychological_safety: 94, moral_clarity: 72,
      behavioral_realism: 38, sensory_vs_intellectual: 28, kinetic_vs_patient: 55 },
  },
  {
    tmdb_id: 'movie-419430', title: 'Get Out', year: 2017,
    dimensions_v2: { narrative_legibility: 38, emotional_directness: 35, plot_vs_character: 45,
      naturalistic_vs_stylized: 48, narrative_closure: 28, intimate_vs_epic: 28,
      accessible_vs_demanding: 38, psychological_safety: 85, moral_clarity: 20,
      behavioral_realism: 38, sensory_vs_intellectual: 42, kinetic_vs_patient: 38 },
  },

  // ── moral_clarity ────────────────────────────────────────────────────────
  {
    tmdb_id: 'movie-155', title: 'The Dark Knight', year: 2008,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 38, plot_vs_character: 28,
      naturalistic_vs_stylized: 42, narrative_closure: 15, intimate_vs_epic: 75,
      accessible_vs_demanding: 18, psychological_safety: 55, moral_clarity: 32,
      behavioral_realism: 48, sensory_vs_intellectual: 38, kinetic_vs_patient: 22 },
  },
  {
    tmdb_id: 'movie-11908', title: 'Before Sunrise', year: 1995,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 45, plot_vs_character: 88,
      naturalistic_vs_stylized: 12, narrative_closure: 58, intimate_vs_epic: 8,
      accessible_vs_demanding: 38, psychological_safety: 38, moral_clarity: 50,
      behavioral_realism: 10, sensory_vs_intellectual: 60, kinetic_vs_patient: 75 },
  },
  {
    tmdb_id: 'movie-275', title: 'The Silence of the Lambs', year: 1991,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 30, plot_vs_character: 40,
      naturalistic_vs_stylized: 35, narrative_closure: 25, intimate_vs_epic: 35,
      accessible_vs_demanding: 25, psychological_safety: 80, moral_clarity: 35,
      behavioral_realism: 42, sensory_vs_intellectual: 38, kinetic_vs_patient: 28 },
  },

  // ── behavioral_realism ───────────────────────────────────────────────────
  {
    tmdb_id: 'movie-120', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 22, plot_vs_character: 38,
      naturalistic_vs_stylized: 62, narrative_closure: 38, intimate_vs_epic: 90,
      accessible_vs_demanding: 28, psychological_safety: 42, moral_clarity: 15,
      behavioral_realism: 88, sensory_vs_intellectual: 32, kinetic_vs_patient: 32 },
  },
  {
    tmdb_id: 'movie-496243', title: 'Parasite', year: 2019,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 38, plot_vs_character: 38,
      naturalistic_vs_stylized: 42, narrative_closure: 32, intimate_vs_epic: 22,
      accessible_vs_demanding: 32, psychological_safety: 68, moral_clarity: 72,
      behavioral_realism: 28, sensory_vs_intellectual: 42, kinetic_vs_patient: 20 },
  },
  {
    tmdb_id: 'movie-194', title: 'Amélie', year: 2001,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 22, plot_vs_character: 70,
      naturalistic_vs_stylized: 80, narrative_closure: 22, intimate_vs_epic: 20,
      accessible_vs_demanding: 28, psychological_safety: 28, moral_clarity: 30,
      behavioral_realism: 72, sensory_vs_intellectual: 28, kinetic_vs_patient: 38 },
  },

  // ── sensory_vs_intellectual ──────────────────────────────────────────────
  {
    tmdb_id: 'movie-335984', title: 'Blade Runner 2049', year: 2017,
    dimensions_v2: { narrative_legibility: 52, emotional_directness: 70, plot_vs_character: 60,
      naturalistic_vs_stylized: 72, narrative_closure: 50, intimate_vs_epic: 62,
      accessible_vs_demanding: 62, psychological_safety: 60, moral_clarity: 65,
      behavioral_realism: 50, sensory_vs_intellectual: 18, kinetic_vs_patient: 75 },
  },
  {
    tmdb_id: 'movie-27205', title: 'Inception', year: 2010,
    dimensions_v2: { narrative_legibility: 42, emotional_directness: 42, plot_vs_character: 28,
      naturalistic_vs_stylized: 58, narrative_closure: 68, intimate_vs_epic: 65,
      accessible_vs_demanding: 38, psychological_safety: 45, moral_clarity: 42,
      behavioral_realism: 52, sensory_vs_intellectual: 78, kinetic_vs_patient: 25 },
  },
  {
    tmdb_id: 'movie-244786', title: 'Whiplash', year: 2014,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 20, plot_vs_character: 68,
      naturalistic_vs_stylized: 45, narrative_closure: 45, intimate_vs_epic: 18,
      accessible_vs_demanding: 28, psychological_safety: 62, moral_clarity: 72,
      behavioral_realism: 35, sensory_vs_intellectual: 28, kinetic_vs_patient: 15 },
  },

  // ── kinetic_vs_patient ───────────────────────────────────────────────────
  {
    tmdb_id: 'movie-62', title: '2001: A Space Odyssey', year: 1968,
    dimensions_v2: { narrative_legibility: 78, emotional_directness: 82, plot_vs_character: 70,
      naturalistic_vs_stylized: 65, narrative_closure: 94, intimate_vs_epic: 92,
      accessible_vs_demanding: 90, psychological_safety: 65, moral_clarity: 78,
      behavioral_realism: 68, sensory_vs_intellectual: 68, kinetic_vs_patient: 88 },
  },
  {
    tmdb_id: 'movie-153', title: 'Lost in Translation', year: 2003,
    dimensions_v2: { narrative_legibility: 35, emotional_directness: 78, plot_vs_character: 85,
      naturalistic_vs_stylized: 22, narrative_closure: 65, intimate_vs_epic: 8,
      accessible_vs_demanding: 62, psychological_safety: 42, moral_clarity: 55,
      behavioral_realism: 18, sensory_vs_intellectual: 45, kinetic_vs_patient: 80 },
  },
  {
    tmdb_id: 'movie-5765', title: 'Stalker', year: 1979,
    dimensions_v2: { narrative_legibility: 78, emotional_directness: 75, plot_vs_character: 68,
      naturalistic_vs_stylized: 38, narrative_closure: 82, intimate_vs_epic: 48,
      accessible_vs_demanding: 94, psychological_safety: 65, moral_clarity: 78,
      behavioral_realism: 52, sensory_vs_intellectual: 68, kinetic_vs_patient: 96 },
  },

  // ── Phase 2 pool expansion ────────────────────────────────────────────────
  // 30 additional well-known films, scored across all 12 dimensions.
  // Broadens each pole from 1–2 anchor films to 4–5 options per pole,
  // so coverage can be achieved even with high skip rates.

  // ── Accessible / mainstream ──────────────────────────────────────────────
  {
    tmdb_id: 'movie-11', title: 'Star Wars: A New Hope', year: 1977,
    dimensions_v2: { narrative_legibility: 8, emotional_directness: 12, plot_vs_character: 15,
      naturalistic_vs_stylized: 70, narrative_closure: 8, intimate_vs_epic: 95,
      accessible_vs_demanding: 5, psychological_safety: 22, moral_clarity: 5,
      behavioral_realism: 95, sensory_vs_intellectual: 15, kinetic_vs_patient: 12 },
  },
  {
    tmdb_id: 'movie-13', title: 'Forrest Gump', year: 1994,
    dimensions_v2: { narrative_legibility: 10, emotional_directness: 8, plot_vs_character: 40,
      naturalistic_vs_stylized: 42, narrative_closure: 12, intimate_vs_epic: 52,
      accessible_vs_demanding: 8, psychological_safety: 28, moral_clarity: 18,
      behavioral_realism: 60, sensory_vs_intellectual: 25, kinetic_vs_patient: 38 },
  },
  {
    tmdb_id: 'movie-354912', title: 'Coco', year: 2017,
    dimensions_v2: { narrative_legibility: 8, emotional_directness: 8, plot_vs_character: 35,
      naturalistic_vs_stylized: 80, narrative_closure: 8, intimate_vs_epic: 42,
      accessible_vs_demanding: 5, psychological_safety: 22, moral_clarity: 15,
      behavioral_realism: 72, sensory_vs_intellectual: 18, kinetic_vs_patient: 22 },
  },
  {
    tmdb_id: 'movie-603', title: 'The Matrix', year: 1999,
    dimensions_v2: { narrative_legibility: 15, emotional_directness: 28, plot_vs_character: 20,
      naturalistic_vs_stylized: 80, narrative_closure: 12, intimate_vs_epic: 75,
      accessible_vs_demanding: 12, psychological_safety: 42, moral_clarity: 18,
      behavioral_realism: 78, sensory_vs_intellectual: 25, kinetic_vs_patient: 10 },
  },
  {
    tmdb_id: 'movie-157336', title: 'Interstellar', year: 2014,
    dimensions_v2: { narrative_legibility: 38, emotional_directness: 18, plot_vs_character: 28,
      naturalistic_vs_stylized: 52, narrative_closure: 32, intimate_vs_epic: 92,
      accessible_vs_demanding: 30, psychological_safety: 40, moral_clarity: 38,
      behavioral_realism: 48, sensory_vs_intellectual: 45, kinetic_vs_patient: 32 },
  },
  {
    tmdb_id: 'movie-546554', title: 'Knives Out', year: 2019,
    dimensions_v2: { narrative_legibility: 25, emotional_directness: 28, plot_vs_character: 32,
      naturalistic_vs_stylized: 38, narrative_closure: 12, intimate_vs_epic: 18,
      accessible_vs_demanding: 12, psychological_safety: 35, moral_clarity: 42,
      behavioral_realism: 30, sensory_vs_intellectual: 60, kinetic_vs_patient: 22 },
  },
  {
    tmdb_id: 'movie-530915', title: '1917', year: 2019,
    dimensions_v2: { narrative_legibility: 10, emotional_directness: 32, plot_vs_character: 15,
      naturalistic_vs_stylized: 40, narrative_closure: 18, intimate_vs_epic: 78,
      accessible_vs_demanding: 18, psychological_safety: 72, moral_clarity: 28,
      behavioral_realism: 28, sensory_vs_intellectual: 15, kinetic_vs_patient: 18 },
  },
  {
    tmdb_id: 'movie-545611', title: 'Everything Everywhere All at Once', year: 2022,
    dimensions_v2: { narrative_legibility: 48, emotional_directness: 15, plot_vs_character: 45,
      naturalistic_vs_stylized: 92, narrative_closure: 18, intimate_vs_epic: 68,
      accessible_vs_demanding: 38, psychological_safety: 55, moral_clarity: 35,
      behavioral_realism: 68, sensory_vs_intellectual: 20, kinetic_vs_patient: 8 },
  },
  {
    tmdb_id: 'movie-389', title: '12 Angry Men', year: 1957,
    dimensions_v2: { narrative_legibility: 10, emotional_directness: 22, plot_vs_character: 58,
      naturalistic_vs_stylized: 12, narrative_closure: 10, intimate_vs_epic: 8,
      accessible_vs_demanding: 12, psychological_safety: 35, moral_clarity: 48,
      behavioral_realism: 10, sensory_vs_intellectual: 75, kinetic_vs_patient: 42 },
  },
  {
    tmdb_id: 'movie-1417', title: "Pan's Labyrinth", year: 2006,
    dimensions_v2: { narrative_legibility: 42, emotional_directness: 22, plot_vs_character: 62,
      naturalistic_vs_stylized: 90, narrative_closure: 42, intimate_vs_epic: 32,
      accessible_vs_demanding: 40, psychological_safety: 78, moral_clarity: 22,
      behavioral_realism: 65, sensory_vs_intellectual: 22, kinetic_vs_patient: 38 },
  },

  // ── Prestige / auteur ────────────────────────────────────────────────────
  {
    tmdb_id: 'movie-152601', title: 'Her', year: 2013,
    dimensions_v2: { narrative_legibility: 28, emotional_directness: 60, plot_vs_character: 88,
      naturalistic_vs_stylized: 65, narrative_closure: 72, intimate_vs_epic: 8,
      accessible_vs_demanding: 40, psychological_safety: 50, moral_clarity: 70,
      behavioral_realism: 20, sensory_vs_intellectual: 65, kinetic_vs_patient: 75 },
  },
  {
    tmdb_id: 'movie-57158', title: 'Drive', year: 2011,
    dimensions_v2: { narrative_legibility: 38, emotional_directness: 82, plot_vs_character: 62,
      naturalistic_vs_stylized: 80, narrative_closure: 42, intimate_vs_epic: 18,
      accessible_vs_demanding: 55, psychological_safety: 70, moral_clarity: 55,
      behavioral_realism: 52, sensory_vs_intellectual: 22, kinetic_vs_patient: 65 },
  },
  {
    tmdb_id: 'movie-4922', title: 'Brokeback Mountain', year: 2005,
    dimensions_v2: { narrative_legibility: 15, emotional_directness: 72, plot_vs_character: 85,
      naturalistic_vs_stylized: 15, narrative_closure: 52, intimate_vs_epic: 10,
      accessible_vs_demanding: 55, psychological_safety: 68, moral_clarity: 55,
      behavioral_realism: 10, sensory_vs_intellectual: 42, kinetic_vs_patient: 80 },
  },
  {
    tmdb_id: 'movie-7345', title: 'There Will Be Blood', year: 2007,
    dimensions_v2: { narrative_legibility: 32, emotional_directness: 82, plot_vs_character: 95,
      naturalistic_vs_stylized: 22, narrative_closure: 52, intimate_vs_epic: 58,
      accessible_vs_demanding: 85, psychological_safety: 65, moral_clarity: 92,
      behavioral_realism: 25, sensory_vs_intellectual: 65, kinetic_vs_patient: 90 },
  },
  {
    tmdb_id: 'movie-281957', title: 'The Revenant', year: 2015,
    dimensions_v2: { narrative_legibility: 18, emotional_directness: 55, plot_vs_character: 45,
      naturalistic_vs_stylized: 20, narrative_closure: 28, intimate_vs_epic: 68,
      accessible_vs_demanding: 52, psychological_safety: 72, moral_clarity: 55,
      behavioral_realism: 18, sensory_vs_intellectual: 18, kinetic_vs_patient: 62 },
  },
  {
    tmdb_id: 'movie-329865', title: 'Arrival', year: 2016,
    dimensions_v2: { narrative_legibility: 55, emotional_directness: 45, plot_vs_character: 60,
      naturalistic_vs_stylized: 48, narrative_closure: 72, intimate_vs_epic: 62,
      accessible_vs_demanding: 45, psychological_safety: 52, moral_clarity: 65,
      behavioral_realism: 22, sensory_vs_intellectual: 72, kinetic_vs_patient: 68 },
  },
  {
    tmdb_id: 'movie-489', title: 'Good Will Hunting', year: 1997,
    dimensions_v2: { narrative_legibility: 12, emotional_directness: 10, plot_vs_character: 78,
      naturalistic_vs_stylized: 18, narrative_closure: 15, intimate_vs_epic: 12,
      accessible_vs_demanding: 22, psychological_safety: 42, moral_clarity: 38,
      behavioral_realism: 12, sensory_vs_intellectual: 52, kinetic_vs_patient: 48 },
  },
  {
    tmdb_id: 'movie-4154', title: 'Vertigo', year: 1958,
    dimensions_v2: { narrative_legibility: 65, emotional_directness: 62, plot_vs_character: 68,
      naturalistic_vs_stylized: 72, narrative_closure: 65, intimate_vs_epic: 15,
      accessible_vs_demanding: 52, psychological_safety: 75, moral_clarity: 72,
      behavioral_realism: 38, sensory_vs_intellectual: 40, kinetic_vs_patient: 68 },
  },
  {
    tmdb_id: 'movie-438631', title: 'Dune: Part One', year: 2021,
    dimensions_v2: { narrative_legibility: 35, emotional_directness: 48, plot_vs_character: 32,
      naturalistic_vs_stylized: 62, narrative_closure: 78, intimate_vs_epic: 95,
      accessible_vs_demanding: 48, psychological_safety: 55, moral_clarity: 55,
      behavioral_realism: 55, sensory_vs_intellectual: 45, kinetic_vs_patient: 68 },
  },

  // ── Provocative / morally complex ────────────────────────────────────────
  {
    tmdb_id: 'movie-550', title: 'Fight Club', year: 1999,
    dimensions_v2: { narrative_legibility: 62, emotional_directness: 52, plot_vs_character: 52,
      naturalistic_vs_stylized: 78, narrative_closure: 55, intimate_vs_epic: 30,
      accessible_vs_demanding: 45, psychological_safety: 78, moral_clarity: 88,
      behavioral_realism: 45, sensory_vs_intellectual: 38, kinetic_vs_patient: 15 },
  },
  {
    tmdb_id: 'movie-694', title: 'The Shining', year: 1980,
    dimensions_v2: { narrative_legibility: 52, emotional_directness: 60, plot_vs_character: 65,
      naturalistic_vs_stylized: 78, narrative_closure: 52, intimate_vs_epic: 18,
      accessible_vs_demanding: 48, psychological_safety: 92, moral_clarity: 65,
      behavioral_realism: 52, sensory_vs_intellectual: 30, kinetic_vs_patient: 62 },
  },
  {
    tmdb_id: 'movie-641', title: 'Requiem for a Dream', year: 2000,
    dimensions_v2: { narrative_legibility: 25, emotional_directness: 30, plot_vs_character: 72,
      naturalistic_vs_stylized: 75, narrative_closure: 32, intimate_vs_epic: 12,
      accessible_vs_demanding: 75, psychological_safety: 97, moral_clarity: 55,
      behavioral_realism: 28, sensory_vs_intellectual: 15, kinetic_vs_patient: 18 },
  },
  {
    tmdb_id: 'movie-77', title: 'Memento', year: 2000,
    dimensions_v2: { narrative_legibility: 85, emotional_directness: 58, plot_vs_character: 55,
      naturalistic_vs_stylized: 40, narrative_closure: 80, intimate_vs_epic: 18,
      accessible_vs_demanding: 72, psychological_safety: 68, moral_clarity: 90,
      behavioral_realism: 32, sensory_vs_intellectual: 75, kinetic_vs_patient: 28 },
  },
  {
    tmdb_id: 'movie-46738', title: 'Black Swan', year: 2010,
    dimensions_v2: { narrative_legibility: 55, emotional_directness: 30, plot_vs_character: 75,
      naturalistic_vs_stylized: 72, narrative_closure: 52, intimate_vs_epic: 15,
      accessible_vs_demanding: 55, psychological_safety: 92, moral_clarity: 62,
      behavioral_realism: 35, sensory_vs_intellectual: 22, kinetic_vs_patient: 32 },
  },
  {
    tmdb_id: 'movie-475557', title: 'Joker', year: 2019,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 38, plot_vs_character: 85,
      naturalistic_vs_stylized: 60, narrative_closure: 55, intimate_vs_epic: 22,
      accessible_vs_demanding: 38, psychological_safety: 88, moral_clarity: 88,
      behavioral_realism: 35, sensory_vs_intellectual: 35, kinetic_vs_patient: 50 },
  },
  {
    tmdb_id: 'movie-210577', title: 'Gone Girl', year: 2014,
    dimensions_v2: { narrative_legibility: 48, emotional_directness: 50, plot_vs_character: 42,
      naturalistic_vs_stylized: 42, narrative_closure: 62, intimate_vs_epic: 15,
      accessible_vs_demanding: 30, psychological_safety: 75, moral_clarity: 88,
      behavioral_realism: 38, sensory_vs_intellectual: 48, kinetic_vs_patient: 28 },
  },
  {
    tmdb_id: 'movie-1124', title: 'The Prestige', year: 2006,
    dimensions_v2: { narrative_legibility: 55, emotional_directness: 48, plot_vs_character: 42,
      naturalistic_vs_stylized: 48, narrative_closure: 48, intimate_vs_epic: 25,
      accessible_vs_demanding: 35, psychological_safety: 65, moral_clarity: 82,
      behavioral_realism: 30, sensory_vs_intellectual: 70, kinetic_vs_patient: 28 },
  },

  // ── Social drama ─────────────────────────────────────────────────────────
  {
    tmdb_id: 'movie-37799', title: 'The Social Network', year: 2010,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 52, plot_vs_character: 58,
      naturalistic_vs_stylized: 32, narrative_closure: 42, intimate_vs_epic: 40,
      accessible_vs_demanding: 28, psychological_safety: 45, moral_clarity: 80,
      behavioral_realism: 18, sensory_vs_intellectual: 68, kinetic_vs_patient: 20 },
  },
  {
    tmdb_id: 'movie-1422', title: 'The Departed', year: 2006,
    dimensions_v2: { narrative_legibility: 22, emotional_directness: 38, plot_vs_character: 40,
      naturalistic_vs_stylized: 45, narrative_closure: 18, intimate_vs_epic: 45,
      accessible_vs_demanding: 25, psychological_safety: 75, moral_clarity: 72,
      behavioral_realism: 22, sensory_vs_intellectual: 30, kinetic_vs_patient: 18 },
  },
  {
    tmdb_id: 'movie-14', title: 'American Beauty', year: 1999,
    dimensions_v2: { narrative_legibility: 28, emotional_directness: 42, plot_vs_character: 72,
      naturalistic_vs_stylized: 55, narrative_closure: 25, intimate_vs_epic: 18,
      accessible_vs_demanding: 35, psychological_safety: 58, moral_clarity: 72,
      behavioral_realism: 35, sensory_vs_intellectual: 55, kinetic_vs_patient: 55 },
  },
]

// Interleaved order — mixes dimension types so the user doesn't notice
// the organizational pattern. Same sequence for every user.
// 6 batches of 6 films each.
const SEQ_INDICES = [
  // Batch 1: instantly recognizable, full range
  0, 3, 6, 12, 21, 24,
  // Batch 2: mix of intimate/epic, emotional range
  9, 15, 18, 27, 30, 33,
  // Batch 3: style extremes
  1, 10, 19, 22, 28, 34,
  // Batch 4: demanding/accessible + moral ambiguity
  7, 13, 16, 25, 31, 35,
  // Batch 5: character-driven + patient
  4, 8, 11, 20, 29, 32,
  // Batch 6: remaining
  2, 5, 14, 17, 23, 26,
]
export const CALIBRATION_SEQUENCE: CalibrationFilm[] = SEQ_INDICES.map(i => CALIBRATION_FILMS[i])

export const BATCH_SIZE        = 6
export const MIN_SEEN_TO_COMPUTE = 10

// Reverse-lookup by tmdb_id for the rate endpoint
export const CALIBRATION_MAP: Record<string, CalibrationFilm> =
  Object.fromEntries(CALIBRATION_FILMS.map(f => [f.tmdb_id, f]))
