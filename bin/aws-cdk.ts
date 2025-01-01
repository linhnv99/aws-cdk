#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { AlbStack } from "../lib/alb-stack";
import { S3Stack } from "../lib/s3-stack";
import { CodebuildStack } from "../lib/codebuild-stack";

const bootstrap = () => {
    const app = new cdk.App();

    const props: cdk.StackProps = {
        env: {
            account: "039612877479",
            region: "us-east-1",
        },
    };

    const network = new NetworkStack(app, "NetworkStack", props);

    const s3 = new S3Stack(app, "S3Stack", props);

    new EcrStack(app, "EcrStack", props);

    new AlbStack(app, "AlbStack", {
        ...props,
        vpc: network.vpc,
        albSecurityGroup: network.albSecurityGroup,
    });

    new CodebuildStack(app, "CodebuildStack", {
        ...props,
        cicdBucket: s3.cicdBucket,
    });
};

bootstrap();
