/**
 * Panel de sugerencias asistidas por IA.
 *
 * Deliberadamente NO escribe nada. Presenta propuestas y deja que la persona
 * acepte las que correspondan, una por una. Un riesgo o un hito que entrara al
 * proyecto sin revision seria un dato sin responsable, y en un sistema donde
 * toda escritura queda auditada con nombre y fecha eso es una contradiccion.
 *
 * Tampoco se presenta como un oraculo: el encabezado dice que son sugerencias
 * y el pie recuerda que el criterio es de quien las lee.
 */

import { useState } from 'react'
import Button from './Button'
import Badge from './Badge'
import { Pista } from './Ayuda'
import { IconIndicador, IconMas, IconRefrescar } from './icons'
import { pedirSugerencias, type EstadoIA, type SugerenciaIA, type TipoSugerencia } from '@/lib/ia'

export default function PanelIA({
  tipo,
  contexto,
  titulo,
  descripcion,
  etiquetaAceptar,
  onAceptar,
  soloLectura,
}: {
  tipo: TipoSugerencia
  /** Se calcula al pulsar, no en cada render: armarlo cuesta y casi nunca se usa. */
  contexto: () => string
  titulo: string
  descripcion: string
  /** Si se omite, las sugerencias solo se leen (caso del portafolio). */
  etiquetaAceptar?: string
  onAceptar?: (s: SugerenciaIA) => void
  soloLectura?: boolean
}) {
  const [estado, setEstado] = useState<EstadoIA>({ estado: 'inactiva' })
  const [aceptadas, setAceptadas] = useState<string[]>([])

  const consultar = async () => {
    setEstado({ estado: 'consultando' })
    setEstado(await pedirSugerencias(tipo, contexto()))
  }

  return (
    <section className="hg-ia" aria-label={titulo}>
      <header className="hg-ia__cabecera">
        <span className="hg-ia__marca" aria-hidden="true">
          <IconIndicador size={15} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="hg-fila" style={{ gap: 6 }}>
            <span className="hg-t-sm hg-t-bold">{titulo}</span>
            <Badge fg="#4338CA" bg="#E0E7FF" titulo="Generado por un modelo de lenguaje, no por el motor de calculo">
              sugerencia
            </Badge>
            <Pista texto="Las sugerencias no se guardan solas. Usted decide cuales entran al proyecto; las que acepte quedan registradas a su nombre en la auditoria." />
          </div>
          <p className="hg-t-xs hg-t-sec" style={{ margin: 0 }}>
            {descripcion}
          </p>
        </div>
        <Button
          variante="secondary"
          tamano="sm"
          cargando={estado.estado === 'consultando'}
          icono={estado.estado === 'listo' ? <IconRefrescar size={14} /> : <IconIndicador size={14} />}
          onClick={() => void consultar()}
        >
          {estado.estado === 'listo' ? 'Volver a sugerir' : 'Sugerir'}
        </Button>
      </header>

      {estado.estado === 'no-configurada' && (
        <p className="hg-t-sm hg-t-sec hg-ia__aviso">
          El asistente de IA no esta configurado en este entorno. El sistema funciona sin el; cuando
          se configure la credencial del proveedor en el gestor de secretos, este panel empezara a
          proponer sin ningun otro cambio.
        </p>
      )}

      {estado.estado === 'error' && (
        <p className="hg-t-sm hg-ia__aviso" role="alert" style={{ color: 'var(--c-danger)' }}>
          {estado.mensaje}
        </p>
      )}

      {estado.estado === 'listo' && estado.sugerencias.length === 0 && (
        <p className="hg-t-sm hg-t-sec hg-ia__aviso">
          El asistente no encontro nada que anadir a lo que ya esta registrado.
        </p>
      )}

      {estado.estado === 'listo' && estado.sugerencias.length > 0 && (
        <>
          <ul className="hg-ia__lista">
            {estado.sugerencias.map((s, i) => {
              const clave = `${i}-${s.titulo}`
              const yaAceptada = aceptadas.includes(clave)
              return (
                <li key={clave} className="hg-ia__item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="hg-t-sm hg-t-bold">{s.titulo}</div>
                    <div className="hg-t-xs hg-t-sec">{s.detalle}</div>
                    {s.extra && (
                      <div className="hg-fila" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {Object.entries(s.extra).map(([k, v]) => (
                          <Badge key={k} fg="#475569" bg="#F1F5F9" titulo={k}>
                            {k}: {v}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {onAceptar && !soloLectura && (
                    <Button
                      variante={yaAceptada ? 'ghost' : 'primary'}
                      tamano="sm"
                      disabled={yaAceptada}
                      icono={yaAceptada ? undefined : <IconMas size={14} />}
                      onClick={() => {
                        onAceptar(s)
                        setAceptadas((a) => [...a, clave])
                      }}
                    >
                      {yaAceptada ? 'Anadida' : (etiquetaAceptar ?? 'Anadir')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="hg-t-xs hg-t-ter hg-ia__pie">
            Propuesto por {estado.modelo}. Son puntos de partida para su criterio, no conclusiones:
            revise cada uno contra lo que usted sabe del proyecto antes de aceptarlo.
          </p>
        </>
      )}
    </section>
  )
}
