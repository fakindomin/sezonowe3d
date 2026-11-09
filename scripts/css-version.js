// Dopisuje do linku tailwind.css skrót zawartości (?v=...), żeby przeglądarki
// nie używały starej wersji stylów z pamięci po zmianach na stronie.
const fs = require('fs');
const crypto = require('crypto');
const hash = crypto.createHash('sha1').update(fs.readFileSync('tailwind.css')).digest('hex').slice(0, 10);
for (const file of ['index.html', 'polityka-prywatnosci.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const next = html.replace(/href="tailwind\.css(\?v=[^"]*)?"/, `href="tailwind.css?v=${hash}"`);
  if (next !== html) fs.writeFileSync(file, next);
}
console.log('tailwind.css?v=' + hash);
