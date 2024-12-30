#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";

const bootstrap = () => {
    const app = new cdk.App();

    new NetworkStack(app, "NetworkStack", {
        env: {
            account: "039612877479",
            region: "us-east-1",
        },
    });
};

bootstrap();
