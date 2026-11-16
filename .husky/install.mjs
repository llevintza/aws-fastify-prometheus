// `prepare` hook. Husky prints its status ("HUSKY=0 skip install", ...) to
// stdout without a newline. `npm pack` runs `prepare`, and
// @semantic-release/npm takes the tarball name from the last stdout line of
// `npm pack`, so that text broke the release ("ENOENT ... HUSKY=0 skip
// install<pkg>.tgz"). Skip silently when hooks are disabled and send any husky
// message to stderr.
if (process.env.HUSKY === '0') process.exit(0);

const { default: husky } = await import('husky');
const message = husky();
if (message) console.error(message);
