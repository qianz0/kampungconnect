function getAreaFromPostalCode(postalCode) {
  if (!postalCode) return null;
  const postal = postalCode.toString().replace(/\D/g, '');
  if (postal.length < 2) return null;

  const sector = parseInt(postal.substring(0, 2));
  const sectorMap = {
    1: 'Raffles Place', 2: 'Tanjong Pagar', 3: 'Tiong Bahru', 
    4: 'Telok Blangah', 5: 'Pasir Panjang', 6: 'High Street',
    7: 'Beach Road', 8: 'Little India', 9: 'Orchard',
    10: 'Tanglin', 11: 'Novena', 12: 'Toa Payoh',
    13: 'Macpherson', 14: 'Geylang', 15: 'Katong', 16: 'Bedok',
    17: 'Changi', 18: 'Pasir Ris', 19: 'Serangoon', 20: 'Hougang',
    21: 'Upper Serangoon', 22: 'Sengkang', 23: 'Punggol',
    24: 'Lim Chu Kang', 25: 'Kranji', 26: 'Upper Thomson', 27: 'Yishun',
    28: 'Seletar', 29: 'Sembawang', 30: 'Mandai', 31: 'Toa Payoh',
    32: 'Toa Payoh', 33: 'Toa Payoh', 34: 'Springleaf', 35: 'Woodlands',
    36: 'Woodlands', 37: 'Woodlands', 38: 'Woodlands',
    39: 'Woodlands', 40: 'Choa Chu Kang', 41: 'Choa Chu Kang',
    42: 'Bukit Batok', 43: 'Bukit Batok', 44: 'Bukit Batok',
    45: 'Bukit Batok', 46: 'Clementi', 47: 'Clementi',
    48: 'Jurong East', 49: 'Jurong East', 50: 'Jurong West',
    51: 'Jurong West', 52: 'Jurong West', 53: 'Bukit Merah',
    54: 'Bukit Merah', 55: 'Queenstown', 56: 'Ang Mo Kio',
    57: 'Ang Mo Kio', 58: 'Bishan', 59: 'Serangoon', 60: 'Bishan',
    61: 'Upper Bukit Timah', 62: 'Alexandra', 63: 'Bukit Merah',
    64: 'Harbourfront', 65: 'Buona Vista', 66: 'Pasir Panjang',
    67: 'High Street', 68: 'Beach Road', 69: 'Rochor', 70: 'Kallang',
    71: 'Geylang', 72: 'Paya Lebar', 73: 'Marine Parade', 74: 'Bedok',
    75: 'Simei', 76: 'Tampines', 77: 'Pasir Ris', 78: 'Pasir Ris',
    79: 'Tampines', 80: 'Tampines', 81: 'Changi', 82: 'Changi'
  };

  return sectorMap[sector] || null;
}

module.exports = { getAreaFromPostalCode };
