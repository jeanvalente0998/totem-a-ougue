import { useEffect, useMemo, useState } from "react";
import "./GerenciamentoProdutos.css";

export default function GerenciamentoProdutos() {
    const [produtos, setProdutos] = useState([]);
    const [secao, setSecao] = useState("");
    const [categoria, setCategoria] = useState("");
    const [subcategoria, setSubcategoria] = useState("");
    const [pesquisa, setPesquisa] = useState("");
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [salvandoProduto, setSalvandoProduto] = useState(null);
    const [erroAtualizacao, setErroAtualizacao] = useState("");

    // Busca os produtos reais do Oracle por meio da API.
    useEffect(() => {
        async function carregarProdutos() {
            try {
                const resposta = await fetch(
                    "http://localhost:3001/api/gerenciamento-produtos"
                );

                if (!resposta.ok) {
                    throw new Error("Erro ao consultar produtos.");
                }

                const dados = await resposta.json();
                setProdutos(dados.produtos ?? []);
            } catch (error) {
                setErro(error.message);
            } finally {
                setCarregando(false);
            }
        }

        carregarProdutos();
    }, []);

    // Monta as seções existentes na consulta.
    const secoes = useMemo(() => {
        const mapa = new Map();

        produtos.forEach((produto) => {
            mapa.set(String(produto.CODSEC), {
                codigo: String(produto.CODSEC),
                descricao: produto.SECAO,
            });
        });

        return [...mapa.values()].sort((a, b) =>
            a.descricao.localeCompare(b.descricao, "pt-BR")
        );
    }, [produtos]);

    // Categorias pertencentes à seção selecionada.
    const categorias = useMemo(() => {
        const mapa = new Map();

        produtos
            .filter((produto) => !secao || String(produto.CODSEC) === secao)
            .forEach((produto) => {
                mapa.set(String(produto.CODCATEGORIA), {
                    codigo: String(produto.CODCATEGORIA),
                    descricao: produto.CATEGORIA,
                });
            });

        return [...mapa.values()].sort((a, b) =>
            a.descricao.localeCompare(b.descricao, "pt-BR")
        );
    }, [produtos, secao]);

    // Subcategorias pertencentes à seção e categoria selecionadas.
    const subcategorias = useMemo(() => {
        const mapa = new Map();

        produtos
            .filter(
                (produto) =>
                    (!secao || String(produto.CODSEC) === secao) &&
                    (!categoria || String(produto.CODCATEGORIA) === categoria)
            )
            .forEach((produto) => {
                mapa.set(String(produto.CODSUBCATEGORIA), {
                    codigo: String(produto.CODSUBCATEGORIA),
                    descricao: produto.SUBCATEGORIA,
                });
            });

        return [...mapa.values()].sort((a, b) =>
            a.descricao.localeCompare(b.descricao, "pt-BR")
        );
    }, [produtos, secao, categoria]);

    // Aplica os filtros à listagem.
    const produtosFiltrados = useMemo(() => {
        const termo = pesquisa.trim().toUpperCase();

        return produtos.filter((produto) => {
            const correspondeSecao =
                !secao || String(produto.CODSEC) === secao;

            const correspondeCategoria =
                !categoria || String(produto.CODCATEGORIA) === categoria;

            const correspondeSubcategoria =
                !subcategoria ||
                String(produto.CODSUBCATEGORIA) === subcategoria;

            const correspondePesquisa =
                !termo ||
                String(produto.CODPROD).includes(termo) ||
                String(produto.DESCRICAO).toUpperCase().includes(termo);

            return (
                correspondeSecao &&
                correspondeCategoria &&
                correspondeSubcategoria &&
                correspondePesquisa
            );
        });
    }, [produtos, secao, categoria, subcategoria, pesquisa]);

    const totalBalcao = produtosFiltrados.filter(
        (produto) => produto.ENVIA_TOTEM === "N"
    ).length;

    async function alterarRetiradaBalcao(produto) {
        if (salvandoProduto !== null) return;

        const novoValor = produto.ENVIA_TOTEM === "N" ? "S" : "N";

        setSalvandoProduto(produto.CODPROD);
        setErroAtualizacao("");

        try {
            const resposta = await fetch(
                `http://localhost:3001/api/gerenciamento-produtos/${produto.CODPROD}/envia-totem`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        enviaTotem: novoValor,
                    }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem || "Não foi possível atualizar o produto."
                );
            }

            // Atualiza a tela somente após a confirmação do Oracle.
            setProdutos((anteriores) =>
                anteriores.map((item) =>
                    item.CODPROD === produto.CODPROD
                        ? { ...item, ENVIA_TOTEM: dados.enviaTotem }
                        : item
                )
            );
        } catch (error) {
            setErroAtualizacao(error.message);
        } finally {
            setSalvandoProduto(null);
        }
    }

    return (
        <main className="gerprod-pagina">
            <div className="gerprod-container">
                <header className="gerprod-cabecalho">
                    <div>
                        <span className="gerprod-etiqueta">
                            COMPREMIX • ADMINISTRAÇÃO
                        </span>

                        <h1>Gerenciamento de Produtos</h1>

                        <p>
                            Configure os produtos exclusivos para retirada no balcão.
                        </p>
                    </div>
                </header>

                <section className="gerprod-filtros">
                    <div className="gerprod-campo">
                        <label htmlFor="filtro-secao">Seção</label>

                        <select
                            id="filtro-secao"
                            value={secao}
                            onChange={(e) => {
                                setSecao(e.target.value);
                                setCategoria("");
                                setSubcategoria("");
                            }}
                        >
                            <option value="">Todas as seções</option>

                            {secoes.map((item) => (
                                <option key={item.codigo} value={item.codigo}>
                                    {item.descricao}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="gerprod-campo">
                        <label htmlFor="filtro-categoria">Categoria</label>

                        <select
                            id="filtro-categoria"
                            value={categoria}
                            onChange={(e) => {
                                setCategoria(e.target.value);
                                setSubcategoria("");
                            }}
                        >
                            <option value="">Todas as categorias</option>

                            {categorias.map((item) => (
                                <option key={item.codigo} value={item.codigo}>
                                    {item.descricao}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="gerprod-campo">
                        <label htmlFor="filtro-subcategoria">
                            Subcategoria
                        </label>

                        <select
                            id="filtro-subcategoria"
                            value={subcategoria}
                            onChange={(e) => setSubcategoria(e.target.value)}
                        >
                            <option value="">Todas as subcategorias</option>

                            {subcategorias.map((item) => (
                                <option key={item.codigo} value={item.codigo}>
                                    {item.descricao}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="gerprod-campo">
                        <label htmlFor="filtro-pesquisa">Pesquisar produto</label>

                        <input
                            id="filtro-pesquisa"
                            type="text"
                            placeholder="Código ou descrição..."
                            value={pesquisa}
                            onChange={(e) => setPesquisa(e.target.value)}
                        />
                    </div>
                </section>

                <section className="gerprod-listagem">
                    {erroAtualizacao && (
                        <p className="gerprod-mensagem gerprod-erro" role="alert">
                            {erroAtualizacao}
                        </p>
                    )}
                    <div className="gerprod-resumo">
                        <div>
                            <strong>{produtosFiltrados.length}</strong>
                            <span>Produtos encontrados</span>
                        </div>

                        <div>
                            <strong>{totalBalcao}</strong>
                            <span>Exclusivos do balcão</span>
                        </div>
                    </div>

                    {carregando ? (
                        <p className="gerprod-mensagem">Carregando produtos...</p>
                    ) : erro ? (
                        <p className="gerprod-mensagem gerprod-erro">{erro}</p>
                    ) : (
                        <div className="gerprod-tabela-wrapper">
                            <table className="gerprod-tabela">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Produto</th>
                                        <th>Seção</th>
                                        <th>Categoria</th>
                                        <th>Subcategoria</th>
                                        <th>Retirada no balcão</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {produtosFiltrados.map((produto) => {
                                        const exclusivoBalcao =
                                            produto.ENVIA_TOTEM === "N";

                                        return (
                                            <tr key={produto.CODPROD}>
                                                <td>{produto.CODPROD}</td>

                                                <td className="gerprod-nome-produto">
                                                    {produto.DESCRICAO}
                                                </td>

                                                <td>{produto.SECAO}</td>
                                                <td>{produto.CATEGORIA}</td>
                                                <td>{produto.SUBCATEGORIA}</td>

                                                <td>
                                                    <label className="gerprod-controle-balcao">
                                                        <input
                                                            type="checkbox"
                                                            checked={exclusivoBalcao}
                                                            disabled={salvandoProduto !== null}
                                                            onChange={() => alterarRetiradaBalcao(produto)}
                                                        />

                                                        <span
                                                            className={
                                                                exclusivoBalcao
                                                                    ? "gerprod-status gerprod-status-balcao"
                                                                    : "gerprod-status gerprod-status-totem"
                                                            }
                                                        >
                                                            {salvandoProduto === produto.CODPROD
                                                                ? "Salvando..."
                                                                : exclusivoBalcao
                                                                    ? "Exclusivo balcão"
                                                                    : "Disponível no totem"}
                                                        </span>
                                                    </label>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {produtosFiltrados.length === 0 && (
                                <p className="gerprod-mensagem">
                                    Nenhum produto encontrado.
                                </p>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}