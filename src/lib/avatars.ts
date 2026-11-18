export interface Avatar {
    id: string;
    name: string;
    src: string;
    bgGradient: string;
}

export const AVATARS: Avatar[] = [
    {
        id: 'avatar-1',
        name: 'The Visionary',
        src: '/avatars/memo_1.png',
        bgGradient: 'from-blue-400 to-cyan-300',
    },
    {
        id: 'avatar-2',
        name: 'The Strategist',
        src: '/avatars/memo_2.png',
        bgGradient: 'from-purple-400 to-pink-300',
    },
    {
        id: 'avatar-3',
        name: 'The Builder',
        src: '/avatars/memo_3.png',
        bgGradient: 'from-orange-400 to-amber-300',
    },
    {
        id: 'avatar-4',
        name: 'The Explorer',
        src: '/avatars/memo_4.png',
        bgGradient: 'from-green-400 to-emerald-300',
    },
    {
        id: 'avatar-5',
        name: 'The Creator',
        src: '/avatars/memo_5.png',
        bgGradient: 'from-pink-400 to-rose-300',
    },
    {
        id: 'avatar-6',
        name: 'The Achiever',
        src: '/avatars/memo_6.png',
        bgGradient: 'from-indigo-400 to-violet-300',
    },
    {
        id: 'avatar-7',
        name: 'The Guardian',
        src: '/avatars/memo_7.png',
        bgGradient: 'from-teal-400 to-cyan-300',
    },
    {
        id: 'avatar-8',
        name: 'The Mastermind',
        src: '/avatars/memo_8.png',
        bgGradient: 'from-red-400 to-orange-300',
    },
    {
        id: 'avatar-9',
        name: 'The Dreamer',
        src: '/avatars/memo_9.png',
        bgGradient: 'from-violet-400 to-fuchsia-300',
    },
    {
        id: 'avatar-10',
        name: 'The Techie',
        src: '/avatars/memo_10.png',
        bgGradient: 'from-slate-400 to-zinc-300',
    },
    {
        id: 'avatar-11',
        name: 'The Artist',
        src: '/avatars/memo_11.png',
        bgGradient: 'from-yellow-400 to-orange-300',
    },
    {
        id: 'avatar-12',
        name: 'The Guru',
        src: '/avatars/memo_12.png',
        bgGradient: 'from-emerald-400 to-teal-300',
    },
    {
        id: 'avatar-13',
        name: 'The Maverick',
        src: '/avatars/vibrent_1.webp',
        bgGradient: 'from-sky-400 to-indigo-300',
    },
    {
        id: 'avatar-14',
        name: 'The Alchemist',
        src: '/avatars/vibrent_2.webp',
        bgGradient: 'from-amber-400 to-red-300',
    },
    {
        id: 'avatar-15',
        name: 'The Catalyst',
        src: '/avatars/vibrent_3.webp',
        bgGradient: 'from-emerald-400 to-green-300',
    },
    {
        id: 'avatar-16',
        name: 'The Pathfinder',
        src: '/avatars/vibrent_4.webp',
        bgGradient: 'from-blue-400 to-teal-300',
    },
    {
        id: 'avatar-17',
        name: 'The Sage',
        src: '/avatars/vibrent_5.webp',
        bgGradient: 'from-indigo-400 to-purple-300',
    },
    {
        id: 'avatar-18',
        name: 'The Rebel',
        src: '/avatars/vibrent_6.webp',
        bgGradient: 'from-red-400 to-rose-300',
    },
    {
        id: 'avatar-19',
        name: 'The Scholar',
        src: '/avatars/vibrent_7.webp',
        bgGradient: 'from-violet-400 to-indigo-300',
    },
    {
        id: 'avatar-20',
        name: 'The Nomad',
        src: '/avatars/vibrent_8.webp',
        bgGradient: 'from-orange-400 to-yellow-300',
    },
    {
        id: 'avatar-21',
        name: 'The Zenith',
        src: '/avatars/vibrent_9.webp',
        bgGradient: 'from-pink-400 to-purple-300',
    },
    {
        id: 'avatar-22',
        name: 'The Voyager',
        src: '/avatars/vibrent_10.webp',
        bgGradient: 'from-teal-400 to-emerald-300',
    },
    {
        id: 'avatar-23',
        name: 'The Titan',
        src: '/avatars/vibrent_11.webp',
        bgGradient: 'from-slate-400 to-blue-300',
    },
    {
        id: 'avatar-24',
        name: 'The Oracle',
        src: '/avatars/vibrent_12.webp',
        bgGradient: 'from-fuchsia-400 to-pink-300',
    },
];

export const getAvatarById = (id?: string) => {
    return AVATARS.find((a) => a.id === id) || AVATARS[0];
};
