
import "./TecladoNumerico.css";

function TecladoNumerico({
    onNumero,
    onApagar,
    onLimpar,
    onFechar,
    onConfirmar,
}) {
    return (
        <div className="teclado-numerico">
            <div className="teclado-numerico-topo">
                <span>Digite seu CPF</span>

                <button
                    type="button"
                    className="teclado-fechar"
                    onClick={onFechar}
                    aria-label="Fechar teclado"
                >
                    ×
                </button>
            </div>

            <div className="teclado-numerico-grade">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
                    (numero) => (
                        <button
                            key={numero}
                            type="button"
                            className="tecla-numero"
                            onClick={() => onNumero(numero)}
                        >
                            {numero}
                        </button>
                    )
                )}

                <button
                    type="button"
                    className="tecla-acao"
                    onClick={onLimpar}
                >
                    Limpar
                </button>

                <button
                    type="button"
                    className="tecla-numero"
                    onClick={() => onNumero("0")}
                >
                    0
                </button>

                <button
                    type="button"
                    className="tecla-acao"
                    onClick={onApagar}
                    aria-label="Apagar último número"
                >
                    ⌫
                </button>
            </div>

            <button
                type="button"
                className="teclado-confirmar"
                onClick={onConfirmar}
            >
                Confirmar
            </button>
        </div>
    );
}

export default TecladoNumerico;
