/**
 * Split an image file name like "3010145 Fogg Body Spray Delicious 120ML.jpg"
 * into a DC code and a product name.
 *
 * Handles the naming variations seen in supplier image folders:
 *  - "3010145 Fogg Body Spray 120ML.jpg"   -> 3010145 | Fogg Body Spray 120ML
 *  - "3000560Bubble Matic 500g.jpg"         -> 3000560 | Bubble Matic 500g   (no space)
 *  - "300149 1Ninja Lqd Vaporizer.jpg"      -> 3001491 | Ninja Lqd Vaporizer (stray space inside code)
 *  - "3006907Selpak Tissue 100's -2.jpg"    -> 3006907 | Selpak Tissue 100's (alt-photo suffix dropped)
 *  - "B Comfort (M).jpg"                    -> ''      | B Comfort (M)       (no code: must be entered)
 */
export function parseProductFilename(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim();

  // A 7-digit code typed with a stray space before its last digit: "300149 1Ninja ..."
  let match = base.match(/^(\d{6}) (\d)([A-Za-z].*)$/);
  if (match) {
    return { dcCode: match[1] + match[2], productName: cleanName(match[3]) };
  }

  match = base.match(/^(\d{4,10})\s*(.*)$/);
  if (match) {
    return { dcCode: match[1], productName: cleanName(match[2]) };
  }

  return { dcCode: '', productName: cleanName(base) };
}

function cleanName(name) {
  // "Product -2" marks a second photo of the same product; it isn't part of the name.
  return name.replace(/\s+-\s*\d+$/, '').trim();
}
