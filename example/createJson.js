var fs = require('fs')
  , raw = fs.readFileSync('data.csv', 'utf8').split('\r\n')
  , headers = raw[0].split(';')
  , data = {}
  , i, j, datum
  ;

for (i = 1; i < raw.length; i += 1) {
  datum = raw[i].split(';');

  data[datum[0]] = {};

  for (j = 1; j < headers.length; j += 1) {
    data[datum[0]][headers[j]] = datum[j].replace(',', '.');

    if (j >= 3) {
      data[datum[0]][headers[j]] = parseFloat(data[datum[0]][headers[j]]);
    }
  }
}

fs.writeFileSync('out.json', JSON.stringify(data), 'utf8');

