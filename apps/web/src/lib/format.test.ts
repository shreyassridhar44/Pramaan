import {
  formatCount,
  formatDate,
  formatINR,
  formatINRCompact,
  formatRelativeDays,
  formatRupeeText,
  groupIndian,
} from './format'

describe('groupIndian', () => {
  it.each([
    [0n, '0'],
    [999n, '999'],
    [1000n, '1,000'],
    [100000n, '1,00,000'],
    [1500000n, '15,00,000'],
    [41250000n, '4,12,50,000'],
    [-3500000n, '-35,00,000'],
  ])('groups %s as %s', (input, expected) => {
    expect(groupIndian(input)).toBe(expected)
  })
})

describe('formatINR', () => {
  it('formats paise as rupees with Indian grouping', () => {
    expect(formatINR('150000000')).toBe('₹15,00,000')
    expect(formatINR(12345)).toBe('₹123.45')
  })
})

describe('formatRupeeText', () => {
  it('formats rupee strings as banks send them', () => {
    expect(formatRupeeText('1500000.00')).toBe('₹15,00,000')
    expect(formatRupeeText('1500000')).toBe('₹15,00,000')
    expect(formatRupeeText('1250.5')).toBe('₹1,250.50')
  })
  it('leaves anything else untouched', () => {
    expect(formatRupeeText('Fifteen Lakh')).toBe('Fifteen Lakh')
  })
})

describe('formatINRCompact', () => {
  it('uses lakh and crore units', () => {
    expect(formatINRCompact(15_00_000_00)).toBe('₹15 L')
    expect(formatINRCompact(35_50_000_00)).toBe('₹35.5 L')
    expect(formatINRCompact(412_60_00_000_00)).toBe('₹412.6 Cr')
    expect(formatINRCompact(50_000_00)).toBe('₹50,000')
  })
})

describe('dates', () => {
  it('formats ISO dates in IST', () => {
    expect(formatDate('2027-03-12')).toBe('12 Mar 2027')
  })

  it('describes relative days', () => {
    expect(formatRelativeDays('2026-11-16', '2026-10-24')).toBe('in 23 days')
    expect(formatRelativeDays('2026-10-19', '2026-10-24')).toBe('5 days ago')
    expect(formatRelativeDays('2026-10-24', '2026-10-24')).toBe('today')
  })
})

describe('formatCount', () => {
  it('groups counts the Indian way', () => {
    expect(formatCount(120345)).toBe('1,20,345')
  })
})
