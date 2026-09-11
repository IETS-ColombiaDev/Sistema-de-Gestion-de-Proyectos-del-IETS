import { describe, expect, it } from 'vitest'
import {
  aISO,
  crearCalendario,
  diffDias,
  domingoPascua,
  festivosColombia,
  finMes,
  inicioSemana,
  sumarDias,
  sumarMeses,
} from '../fechas'

describe('aritmetica de fechas en UTC', () => {
  it('suma dias sin desplazarse por huso horario', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(sumarDias('2024-02-28', 1)).toBe('2024-02-29') // ano bisiesto
  })

  it('calcula la diferencia en dias calendario', () => {
    expect(diffDias('2026-01-01', '2026-01-31')).toBe(30)
    expect(diffDias('2026-01-31', '2026-01-01')).toBe(-30)
  })

  it('acota el dia al sumar meses', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2026-03-15', -1)).toBe('2026-02-15')
  })

  it('resuelve inicio de semana y fin de mes', () => {
    // 2026-09-09 es miercoles
    expect(inicioSemana('2026-09-09')).toBe('2026-09-07')
    expect(inicioSemana('2026-09-07')).toBe('2026-09-07')
    expect(inicioSemana('2026-09-13')).toBe('2026-09-07') // domingo pertenece a la semana previa
    expect(finMes('2026-02-10')).toBe('2026-02-28')
  })
})

describe('festivos de Colombia', () => {
  it('calcula el domingo de Pascua', () => {
    expect(domingoPascua(2026)).toBe('2026-04-05')
    expect(domingoPascua(2025)).toBe('2025-04-20')
  })

  it('produce 18 festivos por ano', () => {
    for (const anio of [2024, 2025, 2026, 2027]) {
      expect(festivosColombia(anio)).toHaveLength(18)
    }
  })

  it('traslada al lunes los festivos de la Ley Emiliani', () => {
    const f2026 = festivosColombia(2026)
    // Reyes: 6 de enero de 2026 es martes -> se traslada al lunes 12
    expect(f2026).toContain('2026-01-12')
    expect(f2026).not.toContain('2026-01-06')
    // Los fijos no se trasladan
    expect(f2026).toContain('2026-01-01')
    expect(f2026).toContain('2026-12-25')
  })

  it('coloca Jueves y Viernes Santo antes de Pascua', () => {
    const f = festivosColombia(2026)
    expect(f).toContain('2026-04-02')
    expect(f).toContain('2026-04-03')
  })
})

describe('calendario de dias habiles', () => {
  const cal = crearCalendario(festivosColombia(2026))

  it('excluye sabados y domingos', () => {
    // lunes 2026-09-07 a viernes 2026-09-11 = 5 dias habiles
    expect(cal.diasHabiles('2026-09-07', '2026-09-11')).toBe(5)
    // incluyendo el fin de semana siguiente sigue siendo 5 + 0
    expect(cal.diasHabiles('2026-09-07', '2026-09-13')).toBe(5)
  })

  it('excluye festivos del catalogo', () => {
    // La semana del 1 de enero de 2026 (jueves festivo)
    expect(cal.esHabil('2026-01-01')).toBe(false)
    expect(cal.esHabil('2026-01-02')).toBe(true)
  })

  it('devuelve 0 cuando el rango esta invertido', () => {
    expect(cal.diasHabiles('2026-09-11', '2026-09-07')).toBe(0)
  })

  it('cuenta 1 para un unico dia habil', () => {
    expect(cal.diasHabiles('2026-09-09', '2026-09-09')).toBe(1)
  })

  it('completa anos ausentes del catalogo sin dejar huecos', () => {
    const soloA2026 = crearCalendario(festivosColombia(2026))
    // 2027-01-01 es festivo y no venia en el catalogo inicial
    expect(soloA2026.esHabil('2027-01-01')).toBe(false)
  })
})

describe('conversion ISO', () => {
  it('serializa un Date UTC sin corrimiento', () => {
    expect(aISO(new Date(Date.UTC(2026, 8, 9)))).toBe('2026-09-09')
  })
})
