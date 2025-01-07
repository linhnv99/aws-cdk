#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { EcrStack } from "../lib/ecr-stack";
import { AlbStack } from "../lib/alb-stack";
import { S3Stack } from "../lib/s3-stack";
import { EcsStack } from "../lib/ecs-stack";
import { CodeDeployStack } from "../lib/codedeploy-stack";
import { CodeBuildStack } from "../lib/codebuild-stack";
import { CodePipelineStack } from "../lib/codepipeline-stack";

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

    const ecr = new EcrStack(app, "EcrStack", props);

    const alb = new AlbStack(app, "AlbStack", {
        ...props,
        vpc: network.vpc,
        albSecurityGroup: network.albSecurityGroup,
    });

    const codebuild = new CodeBuildStack(app, "CodeBuildStack", props);

    // ecs blue/green deployment
    const ecs = new EcsStack(app, "EcsStack", {
        ...props,
        ecrRepository: ecr.ecrRepository,
        vpc: network.vpc,
        ecsServiceSecurityGroup: network.ecsServiceSecurityGroup,
        blueTargetGroup: alb.blueTargetGroup,
    });

    const codedeploy = new CodeDeployStack(app, "CodeDeployStack", {
        ...props,
        ecsServiceSecurityGroup: network.ecsServiceSecurityGroup,
        blueTargetGroup: alb.blueTargetGroup,
        greenTargetGroup: alb.greenTargetGroup,
        albListener: alb.albListener,
        service: ecs.ecsService,
    });

    new CodePipelineStack(app, "CodePipelineStack", {
        ...props,
        supermanDeploymentGroup: codedeploy.ecsDeploymentGroup,
        supermanCodeBuild: codebuild.supermanCodeBuild,
    });
};

bootstrap();
