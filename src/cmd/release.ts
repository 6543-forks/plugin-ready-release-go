import { getChangeLogSection } from "../utils/change";
import { CommandContext, HookContext } from "../utils/types";
import c from "picocolors";

export async function release({
  config,
  exec,
  forge,
  changes,
  nextVersion,
}: CommandContext) {
  const hookCtx: HookContext = {
    exec,
    nextVersion,
  };

  if (config.user.beforeRelease) {
    console.log("# Running beforeRelease hook");
    if ((await config.user.beforeRelease(hookCtx)) === false) {
      return;
    }
  }

  if (!config.ci.repoOwner || !config.ci.repoName) {
    throw new Error("Missing repoOwner or repoName");
  }

  const newChangelogSection = getChangeLogSection(
    nextVersion,
    config,
    changes,
    forge
  );

  const contributors = `# :heart: Thanks to all the people who contributed! :heart:\n\n${changes
    .map((change) => `@${change.author}`)
    .join(", ")}`;

  const releaseDescription = config.user.getReleaseDescription
    ? await config.user.getReleaseDescription(hookCtx)
    : `${contributors}\n\n${newChangelogSection}`;

  console.log("# Creating release");
  const releaseLink = await forge.createRelease({
    owner: config.ci.repoOwner,
    repo: config.ci.repoName,
    tag: nextVersion,
    description: releaseDescription,
    name: nextVersion,
  });

  console.log(c.green("# Successfully created release:"), releaseLink);

  console.log("# Adding release comments to pull-requests");
  for await (const { pullRequestNumber } of changes) {
    if (!pullRequestNumber) {
      continue;
    }

    const comment = `:tada: This PR is included in version ${nextVersion} :tada:

The release is now available [here](${releaseLink})

Thank you for your contribution. :heart::package::rocket:`;

    await forge.addCommentToPullRequest({
      owner: config.ci.repoOwner,
      repo: config.ci.repoName,
      pullRequestNumber,
      comment,
    });
  }

  if (config.user.afterRelease) {
    console.log("# Running afterRelease hook");
    await config.user.afterRelease(hookCtx);
  }
}
