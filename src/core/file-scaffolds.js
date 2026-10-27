export function unitConverterScaffold() {
  return [
    { name: 'unit-converter/index.html', content: `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unit Converter</title>
<link rel="stylesheet" href="styles.css">
<script src="converter.js" defer></script>
<script src="app.js" defer></script>
</head>
<body>
<main>
<h1>Unit Converter</h1>
<form id="converter-form">
<label for="category">Category</label>
<select id="category"><option value="length">Length</option><option value="mass">Mass</option><option value="temperature">Temperature</option></select>
<label for="value">Value</label>
<input id="value" type="number" step="any" required value="1">
<label for="from">From</label>
<select id="from"></select>
<label for="to">To</label>
<select id="to"></select>
<button type="submit">Convert</button>
</form>
<output id="result" aria-live="polite"></output>
</main>
</body>
</html>
` },
    { name: 'unit-converter/styles.css', content: `:root { font-family: system-ui, sans-serif; color-scheme: light dark; }
body { margin: 0; padding: 2rem 1rem; }
main { max-width: 440px; margin: 0 auto; }
form { display: grid; gap: .7rem; }
input, select, button { padding: .7rem; font: inherit; }
button { cursor: pointer; margin-top: .5rem; }
output { display: block; margin-top: 1.5rem; font-weight: 700; }
` },
    { name: 'unit-converter/converter.js', content: `const unitFactors = {
  length: { m: 1, cm: 0.01, km: 1000, in: 0.0254, ft: 0.3048 },
  mass: { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.028349523125 }
};
function convertUnit(value, category, from, to) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('Enter a finite numeric value.');
  if (category === 'temperature') {
    const toKelvin = { C: n => n + 273.15, F: n => (n - 32) * 5 / 9 + 273.15, K: n => n };
    const fromKelvin = { C: n => n - 273.15, F: n => (n - 273.15) * 9 / 5 + 32, K: n => n };
    if (!toKelvin[from] || !fromKelvin[to]) throw new Error('Unsupported temperature unit.');
    const kelvin = toKelvin[from](amount);
    if (kelvin < 0) throw new Error('Temperature cannot be below absolute zero.');
    return fromKelvin[to](kelvin);
  }
  const factors = unitFactors[category];
  if (!factors || !Object.hasOwn(factors, from) || !Object.hasOwn(factors, to)) throw new Error('Unsupported unit conversion.');
  return amount * factors[from] / factors[to];
}
globalThis.convertUnit = convertUnit;
globalThis.converterCategories = { length: Object.keys(unitFactors.length), mass: Object.keys(unitFactors.mass), temperature: ['C', 'F', 'K'] };
` },
    { name: 'unit-converter/app.js', content: `const form = document.getElementById('converter-form');
const category = document.getElementById('category');
const fromUnit = document.getElementById('from');
const toUnit = document.getElementById('to');
const value = document.getElementById('value');
const result = document.getElementById('result');
function updateUnitOptions() {
  const units = globalThis.converterCategories[category.value];
  fromUnit.replaceChildren(...units.map(unit => new Option(unit, unit)));
  toUnit.replaceChildren(...units.map(unit => new Option(unit, unit)));
  toUnit.selectedIndex = Math.min(1, units.length - 1);
  result.textContent = '';
}
category.addEventListener('change', updateUnitOptions);
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const converted = globalThis.convertUnit(value.value, category.value, fromUnit.value, toUnit.value);
    result.textContent = String(Number(converted.toPrecision(12))) + ' ' + toUnit.value;
  } catch (error) {
    result.textContent = error.message;
  }
});
updateUnitOptions();
` }
  ];
}
