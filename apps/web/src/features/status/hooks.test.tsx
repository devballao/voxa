import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const pararCliente = vi.fn();
let aoMudarCapturado: ((e: unknown) => void) | undefined;

vi.mock("../../lib/gateway.ts", async (original) => {
  const real = await original<typeof import("../../lib/gateway.ts")>();
  return {
    ...real,
    criarClienteGateway: vi.fn((o: { aoMudar: (e: unknown) => void }) => {
      aoMudarCapturado = o.aoMudar;
      return { parar: pararCliente };
    }),
  };
});

vi.mock("../../lib/api.ts", () => ({
  lerSaude: vi.fn().mockResolvedValue({ tipo: "inacessivel", motivo: "teste" }),
}));

const { useGateway } = await import("./useGateway.ts");
const { useSaudeApi } = await import("./useSaudeApi.ts");
const { StatusDoAmbiente } = await import("./StatusDoAmbiente.tsx");
const { lerSaude } = await import("../../lib/api.ts");

afterEach(() => vi.useRealTimers());

describe("useGateway", () => {
  it("cria o cliente ao montar, repassa o estado e para ao desmontar", () => {
    const { result, unmount } = renderHook(() => useGateway());
    expect(result.current.conexao).toBe("conectando");
    act(() => aoMudarCapturado?.({ ...result.current, conexao: "conectado" }));
    expect(result.current.conexao).toBe("conectado");
    unmount();
    expect(pararCliente).toHaveBeenCalled();
  });
});

describe("useSaudeApi", () => {
  it("consulta logo ao montar e repete no intervalo", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useSaudeApi(1000));
    await act(async () => {});
    expect(result.current).toEqual({ tipo: "inacessivel", motivo: "teste" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(vi.mocked(lerSaude).mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });
});

describe("StatusDoAmbiente", () => {
  it("monta a página com os dados dos hooks", async () => {
    render(<StatusDoAmbiente />);
    await act(async () => {});
    expect(screen.getByRole("heading", { name: /Status do ambiente/ })).toBeInTheDocument();
    expect(screen.getByText("API inacessível")).toBeInTheDocument();
  });
});
