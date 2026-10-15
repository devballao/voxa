import { configVitestVoxa } from "./vitest.shared.js";

export default configVitestVoxa({
  test: {
    // Este pacote não tem src/: os testes validam os arquivos de configuração.
    coverage: { include: ["vitest.shared.js"] },
  },
});
