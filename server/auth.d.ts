export type AuthUserRow = {
    openId: string;
    name?: string;
    email?: string;
};
export declare const authDatabaseReady: () => Promise<boolean>;
export declare const registerWithEmailAndPassword: (input: {
    name: string;
    email: string;
    password: string;
}) => Promise<AuthUserRow>;
export declare const loginWithEmailAndPassword: (input: {
    email: string;
    password: string;
}) => Promise<AuthUserRow>;
export declare const googleConfigured: () => boolean;
export declare const googleAuthUrl: (redirectUri: string, state: string) => string;
export declare const exchangeGoogleCode: (code: string, redirectUri: string) => Promise<AuthUserRow & {
    provider: 'google';
}>;
export declare const signSessionJwt: (identity: AuthUserRow) => string;
