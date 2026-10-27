import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Produtos.css";
import Comprovante from "./Comprovante";

const categorias = [
    "Todos",
    "Bovina",
    "Suína",
    "Aves",
    "Peixes",
    "Linguiças",
    "Temperados",
    "Outros",
];

function identificarCategoria(nome) {
    const texto = nome.toUpperCase();

    if (texto.includes("LINGUI")) return "Linguiças";
    if (texto.includes("FRANGO") ||
        texto.includes("AVE") ||
        texto.includes("GALETO") ||
        texto.includes("CHESTER")
    ) return "Aves";
    if (
        texto.includes("SUINO") ||
        texto.includes("SUINA") ||
        texto.includes("SUÍNO") ||
        texto.includes("PORCO") ||
        texto.includes("PERNIL") ||
        texto.includes("TORRESMO") ||
        texto.includes("LOMBO")
    ) return "Suína";
    if (
        texto.includes("PEIXE") ||
        texto.includes("POLACA") ||
        texto.includes("BACALHAU")
    ) return "Peixes";
    if (
        texto.includes("TEMPER") ||
        texto.includes("MARINAD")
    ) return "Temperados";
    if (
        texto.includes("BOVIN") ||
        texto.includes("PICANHA") ||
        texto.includes("ALCATRA") ||
        texto.includes("PATINHO") ||
        texto.includes("CONTRA FILE") ||
        texto.includes("CONTRAFILE") ||
        texto.includes("COSTELA") ||
        texto.includes("MUSCULO") ||
        texto.includes("MÚSCULO") ||
        texto.includes("LAGARTO") ||
        texto.includes("COXAO") ||
        texto.includes("COXÃO") ||
        texto.includes("ACEM") ||
        texto.includes("ACÉM") ||
        texto.includes("CUPIM") ||
        texto.includes("PONTA DE PEITO") ||
        texto.includes("CARNE")
    ) return "Bovina";

    return "Outros";
}


// Relaciona os campos do Oracle aos nomes exibidos no dropdown.
const tiposDeCorte = [
    { campo: "BIFE", nome: "Bife" },
    { campo: "MANTA", nome: "Manta" },
    { campo: "PEDACO", nome: "Pedaço" },
    { campo: "MOIDO", nome: "Moído" },
    { campo: "STROGONOFF", nome: "Strogonoff" },
    { campo: "RIPA_PICADA", nome: "Ripa picada" },
    { campo: "MINGA_MANTA", nome: "Minga manta" },
    { campo: "MINGA_PEDACO", nome: "Minga pedaço" },
    { campo: "PICADO", nome: "Picado" },
    { campo: "FATIADO", nome: "Fatiado" },
    { campo: "PECA", nome: "Peça" },
    { campo: "INTEIRO", nome: "Inteiro" },
    { campo: "A_PASSARINHO", nome: "À passarinho" },
];

// Retorna somente os cortes marcados com "S" no Oracle.
function identificarCortes(produto) {
    return tiposDeCorte
        .filter(
            (corte) =>
                String(produto[corte.campo] || "")
                    .trim()
                    .toUpperCase() === "S"
        )
        .map((corte) => ({
            valor: corte.campo,
            nome: corte.nome,
        }));
}


function Produtos({ cliente, onConcluirAtendimento }) {
    const [produtos, setProdutos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [erroProdutos, setErroProdutos] = useState("");
    const [categoriaAtiva, setCategoriaAtiva] = useState("Todos");
    const [carrinho, setCarrinho] = useState([]);
    const [ultimoProdutoClicado, setUltimoProdutoClicado] = useState(null);
    const [modalConfirmacaoAberto, setModalConfirmacaoAberto] =
        useState(false);
    const [enviandoPedido, setEnviandoPedido] = useState(false);
    const [modalSucesso, setModalSucesso] = useState({
        aberta: false,
        senha: "",
    });
    const [dropdownCorteAberto, setDropdownCorteAberto] = useState(null);
    const [dropdownCorteModalAberto, setDropdownCorteModalAberto] =
        useState(null);

    const [comprovante, setComprovante] = useState(null);
    const ultimoPedidoImpresso = useRef(null);

    function concluirAtendimento() {
        setModalSucesso({
            aberta: false,
            senha: "",
        });

        if (onConcluirAtendimento) {
            onConcluirAtendimento();
        }
    }

    useEffect(() => {
        async function carregarProdutos() {
            try {
                setCarregando(true);
                setErroProdutos("");

                const resposta = await fetch(
                    "/api/produtos"
                );

                if (!resposta.ok) {
                    throw new Error("Não foi possível consultar os produtos.");
                }

                const dados = await resposta.json();

                const produtosFormatados = dados.produtos.map((produto) => {
                    const nome = produto.DESCRICAO?.trim() || "Produto sem nome";
                    const unidadeOriginal = String(
                        produto.UNIDADE || "UN"
                    ).trim().toUpperCase();

                    const unidade = unidadeOriginal === "KG"
                        ? "kg"
                        : unidadeOriginal.toLowerCase();


                    return {
                        id: produto.CODPROD,
                        nome,
                        categoria: identificarCategoria(nome),
                        preco: Number(produto.PVENDA),
                        unidade,
                        // Cortes disponíveis conforme cadastro no Oracle.
                        cortesDisponiveis: identificarCortes(produto),
                        // Busca a foto real do produto cadastrada no WinThor.
                        imagem: produto.DIRFOTOPROD
                            ? `/api/produtos/imagem/${produto.CODPROD}`
                            : null,

                        estoque: Number(produto.EST_LIQUIDO),
                    };

                });

                console.log(
                    "Produtos com cortes:",
                    produtosFormatados.filter(
                        (produto) => produto.cortesDisponiveis.length > 0
                    )
                );

                setProdutos(produtosFormatados);
            } catch (erro) {
                console.error("Erro ao carregar produtos:", erro);
                setErroProdutos(
                    "Não foi possível carregar os produtos. Verifique se o servidor está funcionando."
                );
            } finally {
                setCarregando(false);
            }
        }

        carregarProdutos();
    }, []);

    const formatarPreco = (valor) =>
        valor.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

    const formatarPeso = (gramas) =>
        (gramas / 1000).toLocaleString("pt-BR", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
        }) + " kg";


    const produtosFiltrados = useMemo(() => {
        return produtos.filter((produto) => {
            return (
                categoriaAtiva === "Todos" ||
                produto.categoria === categoriaAtiva
            );
        });
    }, [produtos, categoriaAtiva]);

    function adicionarProduto(produto) {
        setUltimoProdutoClicado(produto.id);
        setCarrinho((atual) => {
            const existente = atual.find((item) => item.id === produto.id);

            if (existente) {
                return atual.map((item) =>
                    item.id === produto.id
                        ? {
                            ...item,
                            quantidade: item.quantidade +
                                (produto.unidade === "kg" ? 100 : 1),
                        }
                        : item
                );
            }


            return [
                ...atual,
                {
                    ...produto,
                    quantidade: produto.unidade === "kg" ? 100 : 1,

                    // Guarda o corte escolhido para este produto.
                    // Começa vazio quando o produto exige seleção.
                    corteSelecionado: "",
                },
            ];

        });
    }


    // Atualiza o corte escolhido para um produto do carrinho.
    function alterarCorte(idProduto, novoCorte) {
        setCarrinho((atual) =>
            atual.map((item) => {
                if (item.id !== idProduto) {
                    return item;
                }

                // Aceita somente cortes disponíveis para o produto.
                const corteValido = item.cortesDisponiveis.some(
                    (corte) => corte.valor === novoCorte
                );

                return {
                    ...item,
                    corteSelecionado: corteValido ? novoCorte : "",
                };
            })
        );
    }


    function alterarQuantidade(id, variacao) {
        setCarrinho((atual) =>
            atual
                .map((item) =>
                    item.id === id
                        ? {
                            ...item,
                            quantidade: item.quantidade + variacao,
                        }
                        : item
                )
                .filter((item) => item.quantidade > 0)
        );
    }

    async function confirmarPedido() {
        if (enviandoPedido || carrinho.length === 0) return;

        try {
            setEnviandoPedido(true);

            // Impede o envio caso algum produto esteja sem corte obrigatório.
            const itensSemCorte = carrinho.filter((item) => {
                const cortes = item.cortesDisponiveis || [];

                return (
                    cortes.length > 0 &&
                    !cortes.some(
                        (corte) => corte.valor === item.corteSelecionado
                    )
                );
            });

            if (itensSemCorte.length > 0) {
                alert(
                    "Selecione o tipo de corte de todos os produtos antes de confirmar."
                );
                return;
            }

            const resposta = await fetch(
                "/api/pedidos",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        cpf: cliente.cpf,
                        itens: carrinho.map((item) => ({
                            idProduto: item.id,
                            quantidade: item.unidade === "kg"
                                ? item.quantidade / 1000
                                : item.quantidade,
                            corteSelecionado: item.corteSelecionado || null
                        })),
                    }),
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                alert(dados.mensagem || "Não foi possível enviar o pedido.");
                return;
            }

            // O backend já confirmou a gravação no Oracle.
            const pedidoConfirmado = dados.pedido;

            // Guarda os dados reais do pedido para impressão.
            setComprovante({
                pedidoId: pedidoConfirmado.pedidoId,
                senha: String(pedidoConfirmado.senha).padStart(3, "0"),
                data: new Date().toLocaleString("pt-BR"),
                itens: pedidoConfirmado.itens.map((item) => ({
                    codigo: item.codprod,
                    descricao: item.descricao,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    precoUnitario: item.precoUnitario,
                    subtotal: item.subtotal,
                    tipoCorte: item.tipoCorte,
                })),
                valorTotal: pedidoConfirmado.valorTotal,
            });

            // Limpa o carrinho normalmente.
            setCarrinho([]);
            setUltimoProdutoClicado(null);
            setModalConfirmacaoAberto(false);

            // Mantém o modal de sucesso funcionando.
            setModalSucesso({
                aberta: true,
                senha: String(pedidoConfirmado.senha).padStart(3, "0"),
            });

        } catch (erro) {
            console.error("Erro ao enviar pedido:", erro);
            alert("Não foi possível conectar ao servidor.");
        } finally {
            setEnviandoPedido(false);
        }
    }

    const quantidadeItens = carrinho.length;
    const ultimoItemAdicionado = carrinho.find(
        (item) => item.id === ultimoProdutoClicado
    );

    // Identifica os produtos que exigem corte,
    // mas ainda não possuem uma opção selecionada.
    const produtosSemCorte = carrinho.filter((item) => {
        const exigeCorte = item.cortesDisponiveis?.length > 0;

        const corteValido = item.cortesDisponiveis?.some(
            (corte) => corte.valor === item.corteSelecionado
        );

        return exigeCorte && !corteValido;
    });

    // Todos os cortes obrigatórios foram selecionados?
    const cortesPreenchidos = produtosSemCorte.length === 0;


    const total = carrinho.reduce((soma, item) => {
        const quantidade = item.unidade === "kg"
            ? item.quantidade / 1000
            : item.quantidade;

        return soma + item.preco * quantidade;
    }, 0);

    useEffect(() => {
        // Não imprime enquanto não houver comprovante.
        if (!comprovante?.pedidoId) return;

        // Evita disparar novamente a impressão do mesmo pedido.
        if (ultimoPedidoImpresso.current === comprovante.pedidoId) {
            return;
        }

        // Registra a tentativa antes de abrir a impressão.
        ultimoPedidoImpresso.current = comprovante.pedidoId;

        // Aguarda o React atualizar o conteúdo do comprovante.
        const temporizador = setTimeout(() => {
            window.print();
        }, 300);

        return () => clearTimeout(temporizador);
    }, [comprovante]);



    return (
        <main className="tela-acougue">
            <header className="cabecalho-acougue">
                <div className="titulo-cabecalho">
                    <h1>Escolha seus produtos</h1>
                </div>

                <div className="saudacao">
                    Olá, {
                        (cliente.nome || cliente.CLIENTE || "Cliente")
                            .trim()
                            .split(/\s+/)[0]
                    }!
                </div>
            </header>

            <div className="area-compras">

                <aside className="menu-categorias">
                    {categorias.map((categoria) => (
                        <button
                            key={categoria}
                            type="button"
                            className={`botao-categoria ${categoriaAtiva === categoria ? "ativa" : ""
                                }`}
                            onClick={() => {
                                setCategoriaAtiva(categoria);
                            }}
                        >
                            <span>
                                {categoria === "Todos"
                                    ? "Todos os produtos"
                                    : categoria}
                            </span>

                            <span aria-hidden="true">›</span>
                        </button>
                    ))}
                </aside>

                <section className="area-catalogo">

                    <div className="titulo-catalogo">
                        <h2>{categoriaAtiva}</h2>
                        <span>{produtosFiltrados.length} produtos</span>
                    </div>

                    {carregando && <p>Carregando produtos...</p>}

                    {!carregando && erroProdutos && (
                        <div>
                            <p>{erroProdutos}</p>
                            <button onClick={() => window.location.reload()}>
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {!carregando && !erroProdutos && (
                        <div className="grade-acougue">
                            {produtosFiltrados.map((produto) => (
                                <article
                                    className="produto-acougue"
                                    key={produto.id}
                                >
                                    <img
                                        src={produto.imagem || "/imagem-indisponivel.svg"}
                                        alt={produto.nome}
                                        onError={(event) => {
                                            event.currentTarget.onerror = null;
                                            event.currentTarget.src = "/imagem-indisponivel.svg";
                                        }}
                                    />

                                    <div className="informacoes-produto">
                                        <h3>{produto.nome}</h3>

                                        <p className="preco-acougue">
                                            {formatarPreco(produto.preco)}
                                            <small> / {produto.unidade}</small>
                                        </p>

                                        <button
                                            className="botao-adicionar-acougue"
                                            onClick={() => adicionarProduto(produto)}
                                        >
                                            + Adicionar
                                        </button>
                                    </div>
                                </article>
                            ))}

                            {produtosFiltrados.length === 0 && (
                                <p>Nenhum produto encontrado.</p>
                            )}
                        </div>
                    )}
                </section>
            </div>

            <footer className="carrinho-inferior">
                <button
                    type="button"
                    className="resumo-itens botao-ver-produtos"
                    onClick={() => setModalConfirmacaoAberto(true)}
                    disabled={carrinho.length === 0}
                >

                    <span className="icone-carrinho">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="36"
                            height="36"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M2 2h2.2l1.1 3H21a1 1 0 0 1 .97 1.24l-2.5 10A1 1 0 0 1 18.5 17H7.2a1 1 0 0 1-.95-.68L3.5 4H2a1 1 0 0 1 0-2Z" />
                            <circle cx="8.5" cy="20.5" r="1.8" />
                            <circle cx="18" cy="20.5" r="1.8" />
                        </svg>
                    </span>


                    <span className="texto-ver-produtos">
                        VER PRODUTOS
                    </span>

                    <span className="contador-carrinho">
                        {quantidadeItens}
                    </span>
                </button>

                <div className="lista-carrinho">
                    {!ultimoItemAdicionado ? (
                        <p>Adicione produtos para começar seu pedido.</p>
                    ) : (
                        (() => {
                            const item = ultimoItemAdicionado;

                            const subtotal =
                                item.preco *
                                (item.unidade === "kg"
                                    ? item.quantidade / 1000
                                    : item.quantidade);

                            return (
                                <div className="item-carrinho" key={item.id}>
                                    {item.imagem && (

                                        <img
                                            className="imagem-item-carrinho"
                                            src={item.imagem || "/imagem-indisponivel.svg"}
                                            alt={item.nome}
                                            onError={(event) => {
                                                event.currentTarget.onerror = null;
                                                event.currentTarget.src = "/imagem-indisponivel.svg";
                                            }}
                                        />

                                    )}


                                    <div className="nome-item">
                                        <strong>{item.nome}</strong>

                                        <small className="peso-item">
                                            {item.unidade === "kg"
                                                ? `Peso: ${formatarPeso(item.quantidade)}`
                                                : `Quantidade: ${item.quantidade} un.`}
                                        </small>

                                        {/* Mostra o dropdown somente quando há cortes disponíveis. */}
                                        {item.cortesDisponiveis.length > 0 && (
                                            <div className="area-selecao-corte">

                                                <div className="dropdown-corte-container">

                                                    <button
                                                        type="button"
                                                        className={`dropdown-corte-botao ${dropdownCorteAberto === item.id ? "aberto" : ""
                                                            }`}
                                                        aria-expanded={dropdownCorteAberto === item.id}
                                                        aria-controls={`opcoes-corte-${item.id}`}
                                                        onClick={() =>
                                                            setDropdownCorteAberto((atual) =>
                                                                atual === item.id ? null : item.id
                                                            )
                                                        }
                                                    >
                                                        <span>
                                                            {item.cortesDisponiveis.find(
                                                                (corte) => corte.valor === item.corteSelecionado
                                                            )?.nome || "Selecione o tipo de corte"}
                                                        </span>

                                                        <span className="dropdown-corte-seta">
                                                            {dropdownCorteAberto === item.id ? "⌃" : "⌄"}
                                                        </span>
                                                    </button>

                                                    {dropdownCorteAberto === item.id && (
                                                        <div
                                                            id={`opcoes-corte-${item.id}`}
                                                            className="dropdown-corte-opcoes"
                                                        >

                                                            {item.cortesDisponiveis.map((corte) => (
                                                                <button
                                                                    key={corte.valor}
                                                                    type="button"
                                                                    className={`dropdown-corte-opcao ${item.corteSelecionado === corte.valor
                                                                        ? "selecionado"
                                                                        : ""
                                                                        }`}
                                                                    onClick={() => {
                                                                        alterarCorte(item.id, corte.valor);
                                                                        setDropdownCorteModalAberto(null);
                                                                        // Fecha automaticamente o dropdown do rodapé.
                                                                        setDropdownCorteAberto(false);
                                                                    }}
                                                                >
                                                                    <span>{corte.nome}</span>

                                                                    {item.corteSelecionado === corte.valor && (
                                                                        <span className="modal-corte-check">✓</span>
                                                                    )}
                                                                </button>
                                                            ))}

                                                        </div>
                                                    )}
                                                </div>

                                                {!item.corteSelecionado && (
                                                    <small className="aviso-corte-obrigatorio">
                                                        Selecione um corte para conseguir continuar.
                                                    </small>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <strong className="subtotal-item">
                                        {formatarPreco(subtotal)}
                                    </strong>

                                    <button
                                        type="button"
                                        className="botao-remover"
                                        onClick={() =>
                                            setCarrinho((atual) =>
                                                atual.filter(
                                                    (produto) => produto.id !== item.id
                                                )
                                            )
                                        }
                                        aria-label={`Remover ${item.nome}`}
                                    >
                                        ×
                                    </button>

                                    {/* Controles de quantidade e peso */}
                                    <div className="controles-peso-carrinho">

                                        {/* Botões de incremento rápido somente para KG */}
                                        {item.unidade === "kg" && (
                                            <div className="botoes-peso-rapido">

                                                <button
                                                    type="button"
                                                    className="botao-peso-rapido"
                                                    onClick={() =>
                                                        alterarQuantidade(item.id, 500)
                                                    }
                                                    aria-label={`Adicionar 500 gramas de ${item.nome}`}
                                                >
                                                    + 500 g
                                                </button>

                                                <button
                                                    type="button"
                                                    className="botao-peso-rapido"
                                                    onClick={() =>
                                                        alterarQuantidade(item.id, 1000)
                                                    }
                                                    aria-label={`Adicionar 1 quilo de ${item.nome}`}
                                                >
                                                    + 1 kg
                                                </button>

                                            </div>
                                        )}

                                        {/* Botões originais de ajuste */}
                                        <div className="botoes-ajuste-peso">

                                            <button
                                                type="button"
                                                className="botao-ajuste"
                                                onClick={() =>
                                                    alterarQuantidade(
                                                        item.id,
                                                        item.unidade === "kg" ? -100 : -1
                                                    )
                                                }
                                                aria-label={`Diminuir ${item.nome}`}
                                            >
                                                −
                                            </button>

                                            <button
                                                type="button"
                                                className="botao-ajuste"
                                                onClick={() =>
                                                    alterarQuantidade(
                                                        item.id,
                                                        item.unidade === "kg" ? 100 : 1
                                                    )
                                                }
                                                aria-label={`Aumentar ${item.nome}`}
                                            >
                                                +
                                            </button>

                                        </div>

                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>

                <div className="total-inferior">
                    <span>TOTAL ESTIMADO*</span>
                    <strong>{formatarPreco(total)}</strong>
                    <small className="aviso-peso">
                        * O peso pode variar na produção.
                    </small>
                </div>

                <button
                    className="botao-etiqueta"
                    disabled={carrinho.length === 0}
                    onClick={() => {
                        setDropdownCorteAberto(false);
                        setDropdownCorteModalAberto(null);
                        setModalConfirmacaoAberto(true);
                    }}
                >
                    Gerar Pedido
                </button>

            </footer>

            {modalConfirmacaoAberto && (
                <div className="modal-fundo">
                    <div className="modal-confirmacao">
                        <h2>Confirmar pedido</h2>

                        <p>
                            Confira os produtos e as quantidades
                            antes de continuar.
                        </p>


                        <div className="modal-lista-produtos">
                            {carrinho.map((item) => (
                                <div
                                    className="modal-item-produto"
                                    key={item.id}
                                >
                                    <div className="modal-info-produto">
                                        <strong>{item.nome}</strong>

                                        <p>
                                            {item.unidade === "kg"
                                                ? `Peso: ${formatarPeso(item.quantidade)}`
                                                : `Quantidade: ${item.quantidade} un.`}
                                        </p>
                                    </div>

                                    <strong className="modal-preco-produto">
                                        {formatarPreco(
                                            item.preco *
                                            (item.unidade === "kg"
                                                ? item.quantidade / 1000
                                                : item.quantidade)
                                        )}
                                    </strong>

                                    {/* Dropdown compacto para selecionar o corte */}

                                    {item.cortesDisponiveis?.length > 0 && (
                                        <div className="modal-area-corte">
                                            <div className="dropdown-corte-container modal-dropdown-personalizado">

                                                <button
                                                    type="button"
                                                    className="dropdown-corte-botao"
                                                    aria-expanded={dropdownCorteModalAberto === item.id}
                                                    onClick={() =>
                                                        setDropdownCorteModalAberto((atual) =>
                                                            atual === item.id ? null : item.id
                                                        )
                                                    }
                                                >
                                                    <span>
                                                        {item.cortesDisponiveis.find(
                                                            (corte) =>
                                                                corte.valor === item.corteSelecionado
                                                        )?.nome || "Selecione o corte"}
                                                    </span>

                                                    <span aria-hidden="true">
                                                        {dropdownCorteModalAberto === item.id ? "▲" : "▼"}
                                                    </span>
                                                </button>

                                                {dropdownCorteModalAberto === item.id && (
                                                    <div className="dropdown-corte-opcoes">
                                                        {item.cortesDisponiveis.map((corte) => (
                                                            <button
                                                                key={corte.valor}
                                                                type="button"
                                                                className="dropdown-corte-opcao"
                                                                onClick={() => {
                                                                    alterarCorte(item.id, corte.valor);
                                                                    setDropdownCorteModalAberto(null);
                                                                }}
                                                            >
                                                                {corte.nome}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        className="botao-excluir-modal"
                                        onClick={() => {
                                            setCarrinho((atual) =>
                                                atual.filter(
                                                    (produto) => produto.id !== item.id
                                                )
                                            );

                                            if (ultimoProdutoClicado === item.id) {
                                                setUltimoProdutoClicado(null);
                                            }
                                        }}
                                        disabled={enviandoPedido}
                                        aria-label={`Excluir ${item.nome} do pedido`}
                                        title="Excluir produto"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M3 6h18" />
                                            <path d="M8 6V4h8v2" />
                                            <path d="M19 6l-1 14H6L5 6" />
                                            <path d="M10 10v7" />
                                            <path d="M14 10v7" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="modal-total">
                            <span>TOTAL ESTIMADO</span>
                            <strong>{formatarPreco(total)}</strong>
                        </div>

                        <div className="modal-acoes">
                            <button
                                className="botao-voltar"
                                onClick={() => setModalConfirmacaoAberto(false)}
                                disabled={enviandoPedido}
                            >
                                Voltar
                            </button>


                            {produtosSemCorte.length > 0 && (
                                <p className="aviso-cortes-pendentes" role="alert">
                                    Selecione o tipo de corte dos seguintes produtos
                                    antes de confirmar o pedido:

                                    <strong>
                                        {produtosSemCorte
                                            .map((item) => item.nome)
                                            .join(", ")}
                                    </strong>
                                </p>
                            )}


                            <button
                                className="botao-confirmar"
                                onClick={confirmarPedido}
                                disabled={enviandoPedido || carrinho.length === 0 || !cortesPreenchidos}
                            >
                                {enviandoPedido
                                    ? "Enviando..."
                                    : "Confirmar pedido"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalSucesso.aberta && (
                <div className="modal-fundo">
                    <div
                        className="modal-confirmacao modal-sucesso"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="titulo-sucesso"
                    >

                        <h2 id="titulo-sucesso">
                            Pedido enviado com sucesso!
                        </h2>

                        <p>
                            Seu pedido foi registrado.
                        </p>

                        <div className="senha-pedido">
                            <span>Sua senha é</span>
                            <strong>{modalSucesso.senha}</strong>
                        </div>

                        <div className="modal-acoes">
                            <button
                                className="botao-confirmar"
                                onClick={concluirAtendimento}
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {createPortal(
                <Comprovante pedido={comprovante} />,
                document.body
            )}

        </main>
    );
}

export default Produtos;

