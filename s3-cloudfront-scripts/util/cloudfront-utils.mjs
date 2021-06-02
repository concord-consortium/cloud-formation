function maybeUpdateBehavior(distribution, behavior, modifyBehavior) {
  const origin = distribution.Origins.Items.find((origin) => origin.Id === behavior.TargetOriginId);
  const behaviorPathDescription = behavior.PathPattern ? `pathPattern: ${behavior.PathPattern}` : 'default behavior';
  if (modifyBehavior(distribution, behavior)) {
    console.log(`  updated behavior with origin: ${origin.DomainName}, ${behaviorPathDescription}`);
  } else {
    console.log(`  skipped behavior with origin: ${origin.DomainName}, ${behaviorPathDescription}`);
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function updateDistributions(cloudfront, distributionIds, modifyBehavior) {
  for (const distributionId of distributionIds) {
    const response = await cloudfront.getDistributionConfig({Id: distributionId}).promise();
    const distributionConfig = response.DistributionConfig;
    const aliasesString = distributionConfig.Aliases.Items.join(', ')

    console.log(`updating distribution ${distributionId} aliases ${aliasesString}`);

    maybeUpdateBehavior(distributionConfig, distributionConfig.DefaultCacheBehavior, modifyBehavior);

    for(const cacheBehavior of distributionConfig.CacheBehaviors.Items) {
      maybeUpdateBehavior(distributionConfig, cacheBehavior, modifyBehavior);
    }

    // try waiting 3s to prevent throttling errors
    await wait(3000);

    // need to pass the ETag from the getDistributionConfig call this is required so the
    // API knows the changes being applied are based on the most recent config
    await cloudfront.updateDistribution({DistributionConfig: distributionConfig,
       Id: distributionId, IfMatch: response.ETag}).promise();
  }
}
