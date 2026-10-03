// Fits Clerk's <SignIn /> / <SignUp /> into our AuthLayout: no card chrome or header (the page has its own
// serif title), and our pill buttons and tall inputs.
export const embeddedForm = {
  elements: {
    rootBox: 'w-full',
    // overflow-visible: Clerk clips the card box, which cut the pill ends flat and left a faint frame
    cardBox: 'w-full max-w-none overflow-visible rounded-none border-0 shadow-none',
    card: 'w-full gap-6 rounded-none border-0 bg-transparent p-0 shadow-none',
    header: 'hidden',
    socialButtonsBlockButton: 'h-12 rounded-full text-base',
    formFieldLabel: 'text-sm font-semibold',
    formFieldInput: 'h-12 rounded-xl px-4 text-base',
    formButtonPrimary: 'h-13 rounded-full text-base font-bold',
    footer: 'bg-none bg-transparent px-0',
    footerItem: 'border-0',
    footerActionLink: 'font-bold text-primary',
  },
}
