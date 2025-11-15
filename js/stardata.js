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
  // Ursa Minor (Little Dipper)
  ['Polaris', 2.530, 89.26, 2.0, 'Ursa Minor'],
  ['Kochab', 14.845, 74.16, 2.1, 'Ursa Minor'],
  ['Pherkad', 15.345, 71.83, 3.0, 'Ursa Minor'],
  // Cassiopeia
  ['Schedar', 0.675, 56.54, 2.2, 'Cassiopeia'],
  ['Caph', 0.153, 59.15, 2.3, 'Cassiopeia'],
  ['Cih', 0.945, 60.72, 2.5, 'Cassiopeia'],
  ['Ruchbah', 1.430, 60.24, 2.7, 'Cassiopeia'],
  ['Segin', 1.911, 63.67, 3.4, 'Cassiopeia'],
  // Leo
  ['Regulus', 10.139, 11.97, 1.4, 'Leo'],
  ['Denebola', 11.817, 14.57, 2.1, 'Leo'],
  ['Algieba', 10.333, 19.84, 2.6, 'Leo'],
  // Taurus
  ['Aldebaran', 4.599, 16.51, 0.9, 'Taurus'],
  ['Elnath', 5.438, 28.61, 1.7, 'Taurus'],
  // Gemini
  ['Pollux', 7.755, 28.03, 1.2, 'Gemini'],
  ['Castor', 7.577, 31.89, 1.6, 'Gemini'],
  // Canis Major
  ['Sirius', 6.752, -16.72, -1.5, 'Canis Major'],
  ['Adhara', 6.977, -28.97, 1.5, 'Canis Major'],
  // Boötes
  ['Arcturus', 14.261, 19.18, -0.05, 'Boötes'],
  // Virgo
  ['Spica', 13.420, -11.16, 1.0, 'Virgo'],
  // Lyra
  ['Vega', 18.615, 38.78, 0.0, 'Lyra'],
  // Aquila
  ['Altair', 19.846, 8.87, 0.8, 'Aquila'],
  // Cygnus
  ['Deneb', 20.690, 45.28, 1.3, 'Cygnus'],
  ['Albireo', 19.512, 27.96, 3.1, 'Cygnus'],
  // Scorpius
  ['Antares', 16.490, -26.43, 1.1, 'Scorpius'],
  // Crux (Southern Cross)
  ['Acrux', 12.443, -63.10, 0.8, 'Crux'],
  ['Mimosa', 12.795, -59.69, 1.3, 'Crux'],
  ['Gacrux', 12.519, -57.11, 1.6, 'Crux'],
  // Centaurus
  ['Alpha Centauri', 14.661, -60.84, -0.3, 'Centaurus'],
  ['Beta Centauri', 14.064, -60.37, 0.6, 'Centaurus'],
  // Eridanus
  ['Achernar', 1.629, -57.24, 0.5, 'Eridanus'],
  // Carina
  ['Canopus', 6.399, -52.70, -0.7, 'Carina']
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
  // Little Dipper
  ['Polaris', 'Kochab'],
  ['Kochab', 'Pherkad'],
  // Orion
  ['Betelgeuse', 'Bellatrix'],
  ['Bellatrix', 'Mintaka'],
  ['Mintaka', 'Alnilam'],
  ['Alnilam', 'Alnitak'],
  ['Alnitak', 'Saiph'],
  ['Saiph', 'Rigel'],
  ['Rigel', 'Betelgeuse'],
  ['Betelgeuse', 'Mintaka'],
  ['Alnilam', 'Rigel'],
  // Cassiopeia (W shape)
  ['Caph', 'Schedar'],
  ['Schedar', 'Cih'],
  ['Cih', 'Ruchbah'],
  ['Ruchbah', 'Segin'],
  // Leo (simplified)
  ['Regulus', 'Algieba'],
  ['Regulus', 'Denebola'],
  // Gemini
  ['Castor', 'Pollux'],
  // Summer Triangle
  ['Vega', 'Altair'],
  ['Altair', 'Deneb'],
  ['Deneb', 'Vega'],
  // Cygnus (Northern Cross)
  ['Deneb', 'Albireo'],
  // Southern Cross
  ['Acrux', 'Gacrux'],
  ['Mimosa', 'Gacrux']
];
