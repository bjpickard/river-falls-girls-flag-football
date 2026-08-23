# River Falls Girls Flag Football — editable Cloudflare site

This repository is configured for:

- free Cloudflare Pages hosting,
- automatic deployment from GitHub, and
- browser-based content and image editing through Pages CMS.

The owner account is expected to be `bjpickard` on GitHub.

## What can be edited in Pages CMS

Sign in at https://app.pagescms.org after installing the Pages CMS GitHub app.
The editor includes Site Settings, Homepage Hero, About the Program, Mission and
Vision, Program Values, Teams, Player Pathway, Practices and Playing Time,
Uniform Feature, Coach Profile, Shared Expectations, Fees and Policies,
Frequently Asked Questions, and the Final Call to Action.

Saving in Pages CMS commits the content change to GitHub. Cloudflare detects the
commit, rebuilds the site, and publishes the update automatically.

## GitHub setup

1. Create a new public repository named `river-falls-girls-flag-football`.
2. Upload every file and folder from this package to the repository root.
3. Commit the files to the `main` branch.

## Cloudflare Pages setup

1. In Cloudflare, open Workers & Pages and create a Pages application.
2. Choose Connect to Git and authorize GitHub.
3. Select `bjpickard/river-falls-girls-flag-football`.
4. Use `npm run build` as the build command.
5. Use `dist` as the build output directory.
6. Deploy the project.

## Pages CMS setup

1. Open https://app.pagescms.org and sign in with GitHub.
2. Install/authorize Pages CMS for the repository.
3. Select the River Falls repository.
4. Choose a content section, make an edit, and save.
5. Wait for Cloudflare to finish the automatic deployment.

## Local development (optional)

Run `npm install`, then `npm start`. The production build command is `npm run build`.

## Important

The existing Direct Upload Cloudflare project cannot be converted to Git
integration. Create this as a new Pages project, confirm it works, then move the
custom domain from the old project to the new one.
