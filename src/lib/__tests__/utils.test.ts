import { cn } from '../utils'

describe('utils', () => {
    describe('cn', () => {
        it('merges class names correctly', () => {
            expect(cn('c-1', 'c-2')).toBe('c-1 c-2')
        })

        it('handles conditional classes', () => {
            expect(cn('c-1', true && 'c-2', false && 'c-3')).toBe('c-1 c-2')
        })

        it('merges tailwind classes using tailwind-merge', () => {
            // p-4 should override p-2
            expect(cn('p-2', 'p-4')).toBe('p-4')
        })

        it('handles arrays and objects', () => {
            expect(cn(['c-1', { 'c-2': true, 'c-3': false }])).toBe('c-1 c-2')
        })
    })
})
