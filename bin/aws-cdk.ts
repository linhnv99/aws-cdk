#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";

const bootstrap = () => {
    const app = new cdk.App();

    const props: cdk.StackProps = {
        env: {
            account: "039612877479",
            region: "us-east-1",
        },
    };

    new NetworkStack(app, "NetworkStack", props);
    new EcrStack(app, "EcrStack", props);
};

bootstrap();
