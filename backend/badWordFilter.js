export const badWordsList = [
    { word: 'fuck', severity: 'high' },
    { word: 'shit', severity: 'high' },
    { word: 'bitch', severity: 'high' },
    { word: 'asshole', severity: 'high' },
    { word: 'cunt', severity: 'high' },
    { word: 'dick', severity: 'high' },
    { word: 'pussy', severity: 'high' },
    { word: 'faggot', severity: 'high' },
    { word: 'nigger', severity: 'high' },
    { word: 'nigga', severity: 'high' },
    { word: 'whore', severity: 'high' },
    { word: 'slut', severity: 'high' },
    { word: 'bastard', severity: 'medium' },
    { word: 'douche', severity: 'medium' },
    { word: 'crap', severity: 'low' },
    { word: 'damn', severity: 'low' },
    { word: 'ass', severity: 'medium' },
    { word: 'bullshit', severity: 'high' },
    { word: 'motherfucker', severity: 'high' },
    { word: 'prick', severity: 'medium' },
    { word: 'twat', severity: 'high' },
    { word: 'wanker', severity: 'high' },
    { word: 'cock', severity: 'high' },
    { word: 'sucker', severity: 'low' },
    { word: 'idiot', severity: 'low' },
    { word: 'stupid', severity: 'low' },
    { word: 'dumbass', severity: 'medium' },
    { word: 'jackass', severity: 'medium' },
    { word: 'moron', severity: 'low' },
    { word: 'retard', severity: 'high' },
    { word: 'spic', severity: 'high' },
    { word: 'chink', severity: 'high' },
    { word: 'kike', severity: 'high' },
    { word: 'gook', severity: 'high' },
    { word: 'dyke', severity: 'high' },
    { word: 'tranny', severity: 'high' },
    { word: 'fag', severity: 'high' },
    { word: 'tits', severity: 'medium' },
    { word: 'boobs', severity: 'medium' },
    { word: 'piss', severity: 'low' },
    { word: 'jerk', severity: 'low' },
    { word: 'shitty', severity: 'high' },
    { word: 'fucking', severity: 'high' },
    { word: 'fucker', severity: 'high' },
    { word: 'bitches', severity: 'high' },
    { word: 'dicks', severity: 'high' },
    { word: 'cocksucker', severity: 'high' },
    { word: 'niggers', severity: 'high' },
    { word: 'cunts', severity: 'high' },
    { word: 'assholes', severity: 'high' }
];

function normalizeText(text) {
    return text.toLowerCase()
        .replace(/@/g, 'a')
        .replace(/\$/g, 's')
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/!/g, 'i')
        .replace(/\+/g, 't');
}

export function containsBadWord(text) {
    if (!text) return { flagged: false, matchedWord: null, severity: null };

    const normalizedText = normalizeText(text);

    for (const item of badWordsList) {
        // use word boundaries
        const regex = new RegExp(`\\b${item.word}\\b`, 'i');
        if (regex.test(normalizedText)) {
            return {
                flagged: true,
                matchedWord: item.word,
                severity: item.severity
            };
        }
    }

    return { flagged: false, matchedWord: null, severity: null };
}
