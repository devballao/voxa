import { describe, expect, it } from "vitest";
import { carregarConfig, ErroDeConfiguracao } from "./config.ts";

const valido = {
  DATABASE_URL: "postgres://voxa:voxa@localhost:5432/voxa",
  VALKEY_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:3900",
  S3_REGION: "garage",
  S3_BUCKET: "voxa-dev",
  S3_ACCESS_KEY_ID: "chave",
  S3_SECRET_ACCESS_KEY: "segredo-s3",
  S3_FORCE_PATH_STYLE: "true",
  LIVEKIT_URL: "ws://localhost:7880",
  LIVEKIT_API_KEY: "voxa-dev-key",
  LIVEKIT_API_SECRET: "um-segredo-com-pelo-menos-32-caracteres",
};

describe("carregarConfig", () => {
  it("aplica padrões e converte tipos", () => {
    const c = carregarConfig(valido);
    expect(c).toMatchObject({
      NODE_ENV: "development",
      API_HOST: "127.0.0.1",
      API_PORT: 3000,
      LOG_LEVEL: "info",
      S3_FORCE_PATH_STYLE: true,
    });
  });

  it("lista todas as variáveis com problema, sem expor os valores", () => {
    const env = {
      ...valido,
      DATABASE_URL: "mysql://usuario:senha-secreta@h/b",
      S3_BUCKET: undefined,
    };
    try {
      carregarConfig(env);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDeConfiguracao);
      const erro = e as ErroDeConfiguracao;
      expect(erro.problemas.map((p) => p.split(":")[0])).toEqual(["DATABASE_URL", "S3_BUCKET"]);
      expect(erro.message).not.toContain("senha-secreta");
    }
  });

  it("exige segredo do LiveKit com 32+ caracteres e porta válida", () => {
    expect(() => carregarConfig({ ...valido, LIVEKIT_API_SECRET: "curto" })).toThrow(/32\+/);
    expect(() => carregarConfig({ ...valido, API_PORT: "70000" })).toThrow(/API_PORT/);
  });
});
