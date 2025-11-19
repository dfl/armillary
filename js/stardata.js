// stardata.js - Star and constellation data

// Star data: [name, RA (hours), Dec (degrees), magnitude, constellation]
export const starData = [
  // Ursa Major (Big Dipper)
  ['Dubhe', 11.062, 61.75, 1.8, 'Ursa Major'],
  ['Merak', 11.031, 56.38, 2.4, 'Ursa Major'],
  ['Phecda', 11.897, 53.69, 2.4, 'Ursa Major'],
  ['Megrez', 12.257, 57.03, 3.3, 'Ursa Major'],
  ['Alioth', 12.900, 55.96, 1.8, 'Ursa Major'],
  ['Mizar', 13.399, 54.93, 2.2, 'Ursa Major'],
  ['Alkaid', 13.792, 49.31, 1.9, 'Ursa Major'],
  // Orion
  ['Betelgeuse', 5.919, 7.41, 0.5, 'Orion'],
  ['Rigel', 5.242, -8.20, 0.1, 'Orion'],
  ['Bellatrix', 5.418, 6.35, 1.6, 'Orion'],
  ['Mintaka', 5.533, -0.30, 2.2, 'Orion'],
  ['Alnilam', 5.603, -1.20, 1.7, 'Orion'],
  ['Alnitak', 5.679, -1.94, 1.8, 'Orion'],
  ['Saiph', 5.796, -9.67, 2.1, 'Orion'],
  ['Meissa', 5.588, 9.93, 3.5, 'Orion'],
  ['Hatysa', 5.606, -2.60, 3.7, 'Orion'],
  // Ursa Minor (Little Dipper)
  ['Polaris', 2.530, 89.26, 2.0, 'Ursa Minor'],
  ['Yildun', 17.537, 86.59, 4.4, 'Ursa Minor'],
  ['Epsilon Ursae Minoris', 16.766, 82.04, 4.2, 'Ursa Minor'],
  ['Zeta Ursae Minoris', 15.734, 77.79, 4.3, 'Ursa Minor'],
  ['Eta Ursae Minoris', 16.292, 75.75, 5.0, 'Ursa Minor'],
  ['Kochab', 14.845, 74.16, 2.1, 'Ursa Minor'],
  ['Pherkad', 15.345, 71.83, 3.0, 'Ursa Minor'],
  // Cassiopeia
  ['Schedar', 0.675, 56.54, 2.2, 'Cassiopeia'],
  ['Caph', 0.153, 59.15, 2.3, 'Cassiopeia'],
  ['Cih', 0.945, 60.72, 2.5, 'Cassiopeia'],
  ['Ruchbah', 1.430, 60.24, 2.7, 'Cassiopeia'],
  ['Segin', 1.911, 63.67, 3.4, 'Cassiopeia'],
  // Draco (The Dragon)
  ['Thuban', 14.073, 64.38, 3.7, 'Draco'],
  ['Etamin', 17.943, 51.49, 2.2, 'Draco'],
  ['Rastaban', 17.507, 52.30, 2.8, 'Draco'],
  ['Aldibain', 19.209, 67.66, 3.1, 'Draco'],
  ['Edasich', 15.415, 58.97, 3.3, 'Draco'],
  // Leo
  ['Regulus', 10.139, 11.97, 1.4, 'Leo'],
  ['Denebola', 11.817, 14.57, 2.1, 'Leo'],
  ['Algieba', 10.333, 19.84, 2.6, 'Leo'],
  ['Zosma', 11.235, 20.52, 2.6, 'Leo'],
  ['Chort', 11.237, 15.43, 3.3, 'Leo'],
  ['Rasalas', 10.139, 23.77, 3.9, 'Leo'],
  ['Adhafera', 10.278, 23.42, 3.4, 'Leo'],
  ['Al Jabhah', 10.122, 16.76, 3.5, 'Leo'],
  ['Coxa', 11.236, 15.43, 3.3, 'Leo'],
  ['Ras Elased Australis', 9.764, 23.77, 3.0, 'Leo'],
  ['Ras Elased Borealis', 9.879, 26.00, 3.9, 'Leo'],
  // Leo Minor
  ['Praecipua', 10.887, 34.21, 3.8, 'Leo Minor'],
  // Taurus
  ['Aldebaran', 4.599, 16.51, 0.9, 'Taurus'],
  ['Elnath', 5.438, 28.61, 1.7, 'Taurus'],
  ['Zeta Tauri', 5.628, 21.14, 3.0, 'Taurus'],
  ['Theta Tauri', 4.477, 15.87, 3.4, 'Taurus'],
  ['Gamma Tauri', 4.330, 15.63, 3.7, 'Taurus'],
  ['Ain', 4.477, 19.18, 3.5, 'Taurus'],
  ['Hyadum II', 4.381, 17.54, 3.8, 'Taurus'],
  // Pleiades (Seven Sisters)
  ['Alcyone', 3.791, 24.11, 2.9, 'Taurus'],
  ['Atlas', 3.841, 24.05, 3.6, 'Taurus'],
  ['Electra', 3.755, 24.12, 3.7, 'Taurus'],
  ['Maia', 3.755, 24.37, 3.9, 'Taurus'],
  ['Merope', 3.769, 23.95, 4.1, 'Taurus'],
  ['Taygeta', 3.749, 24.47, 4.3, 'Taurus'],
  ['Pleione', 3.790, 24.14, 5.1, 'Taurus'],
  ['Celaeno', 3.748, 24.29, 5.4, 'Taurus'],
  ['Asterope', 3.744, 24.55, 5.8, 'Taurus'],
  // Gemini
  ['Pollux', 7.755, 28.03, 1.2, 'Gemini'],
  ['Castor', 7.577, 31.89, 1.6, 'Gemini'],
  ['Alhena', 6.628, 16.40, 1.9, 'Gemini'],
  ['Tejat', 6.383, 22.51, 2.9, 'Gemini'],
  ['Wasat', 7.335, 21.98, 3.5, 'Gemini'],
  ['Propus', 6.248, 22.51, 3.3, 'Gemini'],
  // Canis Major
  ['Sirius', 6.752, -16.72, -1.5, 'Canis Major'],
  ['Adhara', 6.977, -28.97, 1.5, 'Canis Major'],
  // Boötes
  ['Arcturus', 14.261, 19.18, -0.05, 'Boötes'],
  ['Izar', 14.750, 27.07, 2.4, 'Boötes'],
  ['Seginus', 14.534, 38.31, 3.0, 'Boötes'],
  ['Princeps', 15.258, 33.31, 3.5, 'Boötes'],
  // Canes Venatici
  ['Cor Caroli', 12.933, 38.32, 2.9, 'Canes Venatici'],
  ['Asterion', 12.564, 41.36, 4.3, 'Canes Venatici'],
  // Crater
  ['Alkes', 10.996, -18.30, 4.1, 'Crater'],
  ['Labrum', 11.322, -14.78, 3.6, 'Crater'],
  // Corona Borealis (Northern Crown)
  ['Alphecca', 15.578, 26.71, 2.2, 'Corona Borealis'],
  ['Nusakan', 15.464, 29.11, 3.7, 'Corona Borealis'],
  ['Theta Coronae Borealis', 15.549, 31.36, 4.1, 'Corona Borealis'],
  // Hercules
  ['Rasalgethi', 17.244, 14.39, 3.5, 'Hercules'],
  ['Kornephoros', 16.503, 21.49, 2.8, 'Hercules'],
  ['Zeta Herculis', 16.688, 31.60, 2.8, 'Hercules'],
  ['Pi Herculis', 17.250, 36.81, 3.2, 'Hercules'],
  ['Eta Herculis', 16.716, 38.92, 3.5, 'Hercules'],
  // Virgo
  ['Spica', 13.420, -11.16, 1.0, 'Virgo'],
  ['Porrima', 12.694, -1.45, 2.7, 'Virgo'],
  ['Vindemiatrix', 13.036, 10.96, 2.8, 'Virgo'],
  ['Zavijava', 11.837, 1.77, 3.6, 'Virgo'],
  ['Zaniah', 12.333, -0.67, 3.9, 'Virgo'],
  ['Syrma', 14.271, -6.00, 4.1, 'Virgo'],
  ['Khambalia', 14.322, -13.37, 4.5, 'Virgo'],
  // Serpens
  ['Unukalhai', 15.738, 6.43, 2.6, 'Serpens'],
  // Lyra
  ['Vega', 18.615, 38.78, 0.0, 'Lyra'],
  // Aquila
  ['Altair', 19.846, 8.87, 0.8, 'Aquila'],
  ['Dheneb', 19.091, 13.86, 2.99, 'Aquila'],
  // Delphinus (The Dolphin)
  ['Rotanev', 20.626, 14.60, 3.6, 'Delphinus'],
  ['Sualocin', 20.661, 15.91, 3.8, 'Delphinus'],
  ['Gamma Delphini', 20.777, 16.12, 4.3, 'Delphinus'],
  ['Delta Delphini', 20.724, 15.07, 4.4, 'Delphinus'],
  // Cygnus
  ['Deneb', 20.690, 45.28, 1.3, 'Cygnus'],
  ['Albireo', 19.512, 27.96, 3.1, 'Cygnus'],
  ['Sadr', 20.371, 40.26, 2.2, 'Cygnus'],
  ['Gienah', 20.770, 33.97, 2.5, 'Cygnus'],
  ['Fawaris', 19.747, 45.13, 2.9, 'Cygnus'],
  // Scorpius
  ['Antares', 16.490, -26.43, 1.1, 'Scorpius'],
  ['Shaula', 17.560, -37.10, 1.6, 'Scorpius'],
  ['Sargas', 17.622, -43.00, 1.9, 'Scorpius'],
  ['Dschubba', 16.005, -22.62, 2.3, 'Scorpius'],
  ['Graffias', 16.092, -19.80, 2.6, 'Scorpius'],
  ['Lesath', 17.507, -37.30, 2.7, 'Scorpius'],
  // Lupus (The Wolf)
  ['Alpha Lupi', 14.698, -47.39, 2.3, 'Lupus'],
  ['Beta Lupi', 14.975, -43.13, 2.7, 'Lupus'],
  ['Gamma Lupi', 15.585, -41.17, 2.8, 'Lupus'],
  ['Delta Lupi', 15.358, -40.64, 3.2, 'Lupus'],
  ['Epsilon Lupi', 15.373, -44.69, 3.4, 'Lupus'],
  // Crux (Southern Cross)
  ['Acrux', 12.443, -63.10, 0.8, 'Crux'],
  ['Mimosa', 12.795, -59.69, 1.3, 'Crux'],
  ['Gacrux', 12.519, -57.11, 1.6, 'Crux'],
  ['Delta Crucis', 12.253, -58.75, 2.8, 'Crux'],
  // Centaurus
  ['Alpha Centauri', 14.661, -60.84, -0.3, 'Centaurus'],
  ['Beta Centauri', 14.064, -60.37, 0.6, 'Centaurus'],
  // Eridanus
  ['Achernar', 1.629, -57.24, 0.5, 'Eridanus'],
  ['Acamar', 2.971, -40.30, 2.9, 'Eridanus'],
  ['Cursa', 5.131, -5.09, 2.8, 'Eridanus'],
  ['Zaurak', 3.967, -13.51, 2.9, 'Eridanus'],
  // Carina
  ['Canopus', 6.399, -52.70, -0.7, 'Carina'],
  // Pegasus
  ['Markab', 23.079, 15.21, 2.5, 'Pegasus'],
  ['Scheat', 23.063, 28.08, 2.4, 'Pegasus'],
  ['Algenib', 0.220, 15.18, 2.8, 'Pegasus'],
  ['Enif', 21.736, 9.88, 2.4, 'Pegasus'],
  ['Kerb', 23.334, 23.74, 4.6, 'Pegasus'],
  // Cepheus
  ['Alderamin', 21.309, 62.59, 2.5, 'Cepheus'],
  // Cetus
  ['Deneb Kaitos', 0.726, -17.99, 2.0, 'Cetus'],
  ['Menkar', 3.038, 4.09, 2.5, 'Cetus'],
  ['Mira', 2.322, -2.98, 3.0, 'Cetus'],
  ['Baten Kaitos', 1.857, -10.33, 3.7, 'Cetus'],
  // Andromeda
  ['Alpheratz', 0.140, 29.09, 2.1, 'Andromeda'],
  ['Mirach', 1.162, 35.62, 2.1, 'Andromeda'],
  ['Almach', 2.065, 42.33, 2.3, 'Andromeda'],
  // Auriga
  ['Capella', 5.278, 46.00, 0.1, 'Auriga'],
  ['Menkalinan', 5.992, 44.95, 1.9, 'Auriga'],
  ['Hoedus I', 5.040, 41.08, 3.7, 'Auriga'],
  ['Hoedus II', 5.110, 41.23, 3.2, 'Auriga'],
  // Columba
  ['Phact', 5.661, -34.07, 2.6, 'Columba'],
  // Perseus
  ['Mirfak', 3.405, 49.86, 1.8, 'Perseus'],
  ['Algol', 3.136, 40.96, 2.1, 'Perseus'],
  // Aquarius
  ['Sadalmelik', 22.096, -0.32, 3.0, 'Aquarius'],
  ['Sadalsuud', 21.526, -5.57, 2.9, 'Aquarius'],
  ['Skat', 22.827, -15.82, 3.3, 'Aquarius'],
  ['Albali', 22.911, -14.55, 3.8, 'Aquarius'],
  ['Sadachbia', 22.360, -1.39, 3.8, 'Aquarius'],
  // Pisces
  ['Alrescha', 2.034, 2.76, 3.8, 'Pisces'],
  ['Kullat Nunu', 1.727, 15.35, 4.4, 'Pisces'],
  ['Fum al Samakah', 23.286, 6.38, 4.5, 'Pisces'],
  ['Al Pherg', 1.523, 15.35, 3.6, 'Pisces'],
  // Aries
  ['Hamal', 2.119, 23.46, 2.0, 'Aries'],
  ['Sheratan', 1.911, 20.81, 2.6, 'Aries'],
  ['Mesarthim', 1.911, 19.29, 4.6, 'Aries'],
  // Cancer
  ['Acubens', 8.974, 11.86, 4.3, 'Cancer'],
  ['Asellus Australis', 8.743, 18.15, 3.9, 'Cancer'],
  ['Asellus Borealis', 8.738, 21.47, 4.7, 'Cancer'],
  ['Altarf', 8.275, 9.19, 3.5, 'Cancer'],
  // Canis Minor
  ['Procyon', 7.655, 5.22, 0.4, 'Canis Minor'],
  // Hydra
  ['Alphard', 9.460, -8.66, 2.0, 'Hydra'],
  // Corvus (The Crow)
  ['Gienah Corvi', 12.263, -17.54, 2.6, 'Corvus'],
  ['Kraz', 12.573, -23.40, 2.7, 'Corvus'],
  ['Algorab', 12.498, -16.52, 2.9, 'Corvus'],
  ['Minkar', 12.168, -22.62, 3.0, 'Corvus'],
  // Libra
  ['Zubenelgenubi', 14.849, -16.04, 2.8, 'Libra'],
  ['Zubeneschamali', 15.283, -9.38, 2.6, 'Libra'],
  // Ophiuchus
  ['Rasalhague', 17.582, 12.56, 2.1, 'Ophiuchus'],
  ['Sabik', 17.173, -15.72, 2.4, 'Ophiuchus'],
  ['Yed Prior', 16.240, -3.69, 2.7, 'Ophiuchus'],
  ['Yed Posterior', 16.302, -4.69, 3.2, 'Ophiuchus'],
  ['Han', 16.619, -10.57, 2.6, 'Ophiuchus'],
  ['Sinistra', 17.988, -9.77, 3.3, 'Ophiuchus'],
  // Sagittarius
  ['Kaus Australis', 18.403, -34.38, 1.9, 'Sagittarius'],
  ['Nunki', 18.921, -26.30, 2.0, 'Sagittarius'],
  ['Kaus Media', 18.350, -29.83, 2.7, 'Sagittarius'],
  ['Kaus Borealis', 18.403, -25.42, 2.8, 'Sagittarius'],
  ['Ascella', 19.079, -29.88, 2.6, 'Sagittarius'],
  ['Albaldah', 19.372, -29.57, 2.8, 'Sagittarius'],
  ['Polis', 18.229, -21.06, 3.9, 'Sagittarius'],
  ['Rukbat', 19.396, -40.62, 4.0, 'Sagittarius'],
  // Capricornus
  ['Deneb Algedi', 21.784, -16.13, 2.9, 'Capricornus'],
  ['Dabih', 20.351, -14.78, 3.1, 'Capricornus'],
  ['Nashira', 21.668, -16.66, 3.7, 'Capricornus'],
  ['Algedi', 20.298, -12.51, 3.6, 'Capricornus'],
  ['Dorsum', 21.099, -17.23, 4.1, 'Capricornus'],
  ['Castra', 21.620, -19.46, 4.5, 'Capricornus'],
  ['Armus', 21.674, -19.87, 4.8, 'Capricornus'],
  // Piscis Austrinus
  ['Fomalhaut', 22.960, -29.62, 1.2, 'Piscis Austrinus'],
  // Grus
  ['Alnair', 22.137, -46.96, 1.7, 'Grus']
];

// Constellation line connections: [star1_name, star2_name]
export const constellationLines = [
  // Big Dipper
  ['Dubhe', 'Merak'],
  ['Merak', 'Phecda'],
  ['Phecda', 'Megrez'],
  ['Megrez', 'Alioth'],
  ['Alioth', 'Mizar'],
  ['Mizar', 'Alkaid'],
  ['Megrez', 'Dubhe'],
  // Little Dipper (proper dipper shape)
  // Bowl (4 stars forming quadrilateral)
  ['Pherkad', 'Kochab'],
  ['Kochab', 'Zeta Ursae Minoris'],
  ['Zeta Ursae Minoris', 'Eta Ursae Minoris'],
  ['Eta Ursae Minoris', 'Pherkad'],
  // Handle (from bowl to Polaris)
  ['Zeta Ursae Minoris', 'Epsilon Ursae Minoris'],
  ['Epsilon Ursae Minoris', 'Yildun'],
  ['Yildun', 'Polaris'],
  // Orion (proper bow-tie shape)
  // Belt (3 stars in a row)
  ['Mintaka', 'Alnilam'],
  ['Alnilam', 'Alnitak'],
  // Left side from shoulder to belt to foot
  ['Betelgeuse', 'Alnitak'],
  ['Alnitak', 'Saiph'],
  // Right side from shoulder to belt to foot
  ['Bellatrix', 'Mintaka'],
  ['Mintaka', 'Rigel'],
  // Shoulders and feet
  ['Betelgeuse', 'Bellatrix'],
  ['Saiph', 'Rigel'],
  // Cassiopeia (W shape)
  ['Caph', 'Schedar'],
  ['Schedar', 'Cih'],
  ['Cih', 'Ruchbah'],
  ['Ruchbah', 'Segin'],
  // Leo
  ['Regulus', 'Algieba'],
  ['Regulus', 'Denebola'],
  ['Denebola', 'Zosma'],
  ['Zosma', 'Chort'],
  ['Chort', 'Regulus'],
  // Gemini (The Twins)
  ['Castor', 'Pollux'],
  // Taurus (The Bull - V-shaped Hyades face and horns)
  // V-shaped face (Hyades cluster)
  ['Gamma Tauri', 'Aldebaran'],
  ['Aldebaran', 'Theta Tauri'],
  // Horns extending from the face
  ['Aldebaran', 'Elnath'],
  ['Theta Tauri', 'Zeta Tauri'],
  // Cancer (The Crab)
  ['Acubens', 'Asellus Australis'],
  ['Asellus Australis', 'Asellus Borealis'],
  ['Asellus Borealis', 'Altarf'],
  ['Altarf', 'Acubens'],
  // Virgo (The Maiden)
  ['Zavijava', 'Porrima'],
  ['Porrima', 'Spica'],
  ['Spica', 'Vindemiatrix'],
  // Libra (The Scales)
  ['Zubenelgenubi', 'Zubeneschamali'],
  // Ophiuchus (Serpent Bearer)
  ['Rasalhague', 'Sabik'],
  ['Yed Prior', 'Yed Posterior'],
  ['Yed Posterior', 'Sabik'],
  // Sagittarius (The Archer - Teapot shape)
  // Body of the teapot (pentagon)
  ['Kaus Australis', 'Kaus Media'],   // Left side bottom
  ['Kaus Media', 'Kaus Borealis'],    // Left side top
  ['Kaus Borealis', 'Nunki'],         // Top edge
  ['Nunki', 'Ascella'],               // Right side
  ['Ascella', 'Kaus Australis'],      // Bottom edge
  // Spout extending from body
  ['Nunki', 'Albaldah'],              // Spout
  // Capricornus (The Sea-Goat)
  ['Dabih', 'Nashira'],
  ['Nashira', 'Deneb Algedi'],
  // Aquarius (Water Bearer)
  ['Sadalsuud', 'Sadalmelik'],
  ['Sadalmelik', 'Skat'],
  ['Skat', 'Albali'],
  // Pisces (The Fish)
  ['Alrescha', 'Kullat Nunu'],
  ['Alrescha', 'Fum al Samakah'],
  // Aries (The Ram)
  ['Hamal', 'Sheratan'],
  // Summer Triangle
  ['Vega', 'Altair'],
  ['Altair', 'Deneb'],
  ['Deneb', 'Vega'],
  // Cygnus (Northern Cross)
  ['Deneb', 'Albireo'],
  ['Deneb', 'Sadr'],
  ['Sadr', 'Albireo'],
  ['Sadr', 'Gienah'],
  ['Sadr', 'Fawaris'],
  // Scorpius (full constellation)
  ['Graffias', 'Dschubba'],
  ['Dschubba', 'Antares'],
  ['Antares', 'Shaula'],
  ['Shaula', 'Sargas'],
  // Pegasus (Great Square)
  ['Markab', 'Scheat'],
  ['Scheat', 'Algenib'],
  ['Algenib', 'Alpheratz'],
  ['Alpheratz', 'Markab'],
  ['Scheat', 'Enif'],
  // Andromeda
  ['Alpheratz', 'Mirach'],
  ['Mirach', 'Almach'],
  // Orion (additional lines)
  ['Meissa', 'Betelgeuse'],
  ['Meissa', 'Bellatrix'],
  // Southern Cross (proper cross shape)
  ['Acrux', 'Gacrux'],        // Vertical axis (bottom to top)
  ['Mimosa', 'Delta Crucis'], // Horizontal axis (left to right)
  // Draco (The Dragon - winding between the dippers)
  ['Rastaban', 'Etamin'],     // Head
  ['Etamin', 'Aldibain'],     // Neck to tail
  ['Thuban', 'Edasich'],      // Body segment
  ['Edasich', 'Rastaban'],    // Body to head
  // Corvus (The Crow - quadrilateral)
  ['Gienah Corvi', 'Algorab'],
  ['Algorab', 'Kraz'],
  ['Kraz', 'Minkar'],
  ['Minkar', 'Gienah Corvi'],
  // Corona Borealis (Northern Crown - semicircular arc)
  ['Theta Coronae Borealis', 'Nusakan'],
  ['Nusakan', 'Alphecca'],
  // Hercules (The Keystone)
  ['Eta Herculis', 'Zeta Herculis'],     // Top of keystone
  ['Zeta Herculis', 'Kornephoros'],      // Right side
  ['Kornephoros', 'Rasalgethi'],         // Bottom
  ['Pi Herculis', 'Eta Herculis'],       // Left side
  ['Pi Herculis', 'Rasalgethi'],         // Close the keystone
  // Lupus (The Wolf - pentagon shape)
  ['Alpha Lupi', 'Beta Lupi'],
  ['Beta Lupi', 'Gamma Lupi'],
  ['Gamma Lupi', 'Delta Lupi'],
  ['Delta Lupi', 'Epsilon Lupi'],
  ['Epsilon Lupi', 'Alpha Lupi'],
  // Delphinus (The Dolphin - diamond shape)
  ['Sualocin', 'Gamma Delphini'],
  ['Gamma Delphini', 'Delta Delphini'],
  ['Delta Delphini', 'Rotanev'],
  ['Rotanev', 'Sualocin']
];
