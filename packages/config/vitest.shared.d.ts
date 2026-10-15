import type { UserConfigFnObject, ViteUserConfig } from "vitest/config";

export declare const voxaVitest: ViteUserConfig;

export declare const MODO_INTEGRACAO: "integration";

export declare function configVitestVoxa(ajustes?: ViteUserConfig): UserConfigFnObject;

export declare function integracaoDisponivel(disponivel: boolean, comoResolver: string): boolean;
