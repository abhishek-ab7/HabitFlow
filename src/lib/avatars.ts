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
];

export const getAvatarById = (id?: string) => {
    return AVATARS.find((a) => a.id === id) || AVATARS[0];
};
