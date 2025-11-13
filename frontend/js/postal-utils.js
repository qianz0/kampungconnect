// Utility functions for Singapore postal code handling
// This is a frontend version of the backend postal-utils.js
// Keep this in sync with: backend/services/matching-service/src/postal-utils.js

/**
 * Convert Singapore postal code to area name
 * @param {string|number} postalCode - The postal code to convert
 * @returns {string|null} The area name or null if not found/invalid
 */
function getAreaFromPostalCode(postalCode) {
    if (!postalCode) return null;
    const postal = postalCode.toString().replace(/\D/g, '');
    if (postal.length < 2) return null;

    const sector = parseInt(postal.substring(0, 2));
    const sectorMap = {
        // District 01 - Raffles Place, Cecil, Marina, People's Park
        1: 'Raffles Place', 2: 'Raffles Place', 3: 'Raffles Place',
        4: 'Raffles Place', 5: 'Raffles Place', 6: 'Raffles Place',

        // District 02 - Anson, Tanjong Pagar
        7: 'Tanjong Pagar', 8: 'Tanjong Pagar',

        // District 03 - Queenstown, Tiong Bahru
        14: 'Queenstown', 15: 'Queenstown', 16: 'Queenstown',

        // District 04 - Telok Blangah, Harbourfront
        9: 'Telok Blangah', 10: 'Harbourfront',

        // District 05 - Pasir Panjang, Hong Leong Garden, Clementi New Town
        11: 'Pasir Panjang', 12: 'Clementi', 13: 'Clementi',

        // District 06 - High Street
        17: 'High Street',

        // District 07 - Middle Road, Golden Mile, Beach Road
        18: 'Beach Road', 19: 'Beach Road',

        // District 08 - Little India
        20: 'Little India', 21: 'Little India',

        // District 09 - Orchard, Cairnhill, River Valley
        22: 'Orchard', 23: 'Orchard',

        // District 10 - Ardmore, Bukit Timah, Holland Road, Tanglin
        24: 'Tanglin', 25: 'Tanglin', 26: 'Tanglin', 27: 'Tanglin',

        // District 11 - Watten Estate, Novena, Thomson
        28: 'Novena', 29: 'Novena', 30: 'Novena',

        // District 12 - Balestier, Toa Payoh
        31: 'Toa Payoh', 32: 'Toa Payoh', 33: 'Toa Payoh',

        // District 13 - Macpherson, Braddell, Potong Pasir
        34: 'Macpherson', 35: 'Macpherson', 36: 'Macpherson', 37: 'Macpherson',

        // District 14 - Geylang, Eunos
        38: 'Geylang', 39: 'Geylang', 40: 'Geylang', 41: 'Geylang',

        // District 15 - Katong, Joo Chiat, Amber Road
        42: 'Katong', 43: 'Katong', 44: 'Katong', 45: 'Katong',

        // District 16 - Bedok, Upper East Coast
        46: 'Bedok', 47: 'Bedok', 48: 'Bedok',

        // District 17 - Loyang, Changi
        49: 'Changi', 50: 'Changi', 81: 'Changi',

        // District 18 - Simei, Tampines, Pasir Ris
        51: 'Pasir Ris', 52: 'Tampines',

        // District 19 - Serangoon Garden, Hougang, Punggol, Sengkang
        53: 'Hougang', 54: 'Sengkang', 55: 'Hougang', 82: 'Punggol', 83: 'Punggol',

        // District 20 - Bishan, Ang Mo Kio
        56: 'Ang Mo Kio', 57: 'Ang Mo Kio',

        // District 21 - Upper Bukit Timah, Clementi Park, Ulu Pandan
        58: 'Upper Bukit Timah', 59: 'Upper Bukit Timah',

        // District 22 - Jurong
        60: 'Jurong', 61: 'Jurong', 62: 'Jurong', 63: 'Jurong', 64: 'Jurong',

        // District 23 - Hillview, Dairy Farm, Bukit Panjang, Choa Chu Kang
        65: 'Bukit Panjang', 66: 'Bukit Panjang', 67: 'Choa Chu Kang', 68: 'Choa Chu Kang',

        // District 24 - Lim Chu Kang, Tengah
        69: 'Lim Chu Kang', 70: 'Lim Chu Kang', 71: 'Lim Chu Kang',

        // District 25 - Admiralty, Woodlands
        72: 'Woodlands', 73: 'Woodlands',

        // District 26 - Upper Thomson, Springleaf
        77: 'Upper Thomson', 78: 'Upper Thomson',

        // District 27 - Yishun, Sembawang
        75: 'Yishun', 76: 'Yishun',

        // District 28 - Seletar
        79: 'Seletar', 80: 'Seletar'
    };

    return sectorMap[sector] || null;
}