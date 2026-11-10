// Picker rebuilds keep each group's Load more progress: what is read back
// from the old content, and how a remembered count is clamped.

loadConst(['PICKER_PROVIDER_LIMIT']);
load(['pickerShownCounts', 'pickerRestoredShown']);

function section(label, shown) {
  return { dataset: { kteLabel: label, kteShown: shown } };
}
var content = {
  querySelectorAll: () => [
    section('7TV', '120'),
    section('BTTV', '40'),
    section('', '80'),
    section('FFZ', 'NaN'),
  ],
};
var counts = pickerShownCounts(content);
check('reads each labelled section', counts.get('7TV') === 120 && counts.get('BTTV') === 40);
check('skips an unlabelled section', !counts.has(''));
check('skips an unreadable count', !counts.has('FFZ'));
check('no old content: nothing to restore', pickerShownCounts(null).size === 0);

check('nothing saved: first page', pickerRestoredShown(undefined, 300) === 40);
check('saved past the first page: restored', pickerRestoredShown(120, 300) === 120);
check('group shrank: clamped to its size', pickerRestoredShown(120, 90) === 90);
check('saved below the first page: first page', pickerRestoredShown(10, 300) === 40);
check('small group: all of it', pickerRestoredShown(undefined, 12) === 12);
check('non-integer saved: first page', pickerRestoredShown(NaN, 300) === 40);
