# ikinyarwanda-lang

A Kinyarwanda scripting language interpreter for browser and Node.js projects.

## Install

```bash
npm install ikinyarwanda-lang
```

## CLI

```bash
npx ikin run examples/hello.ikw
# or after global install
ikin run examples/hello.ikw
```

The CLI accepts `.ikw` files only.

## Language Features

### Core commands

- `andika(value)` prints to console
- `muburire(value)` shows an alert in browser environments
- `shyiramo('#selector', value)` sets `innerText`
- `hindura_ibuju('#selector', color)` sets text color
- `idafite_agaciro('#selector')` validates empty input
- `si_imererwe_neza('#selector')` validates email shape
- `ntibihuye('#a', '#b')` validates mismatch
- `fata('#form')` returns `FormData`
- `subiza('/api/path', payload)` sends POST
- `zana('/api/path')` sends GET

### Variables

```txt
izina = 'Muraho';
count = 3;
andika(izina);
```

### Loops

```txt
subiramo(3) {
  andika('Loop');
}

subiramo(i, 1, 3) {
  andika(i);
}
```

### Functions

```txt
umukoro greet(name) {
  andika(name);
}

greet('NAX');
```

## JavaScript Usage

```js
import { runKinyarwanda } from "ikinyarwanda-lang";

await runKinyarwanda(`
  izina = 'Muraho';

  umukoro vuga(name) {
    andika(name);
  }

  subiramo(i, 1, 2) {
    vuga(izina);
    andika(i);
  }
`);
```

## TypeScript Support

Type declarations are included automatically.

```ts
import { runKinyarwanda, RunKinyarwandaResult } from "ikinyarwanda-lang";

const result: RunKinyarwandaResult = await runKinyarwanda("andika('Muraho');");
```

## Project Docs Website

A static documentation page is included in `docs/index.html`.

Open it with any static server, for example:

```bash
npx serve .
```

Then visit `/docs/index.html`.

## License

MIT
