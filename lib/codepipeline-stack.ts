import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipelineActions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";

interface CodePipelineStackProps extends cdk.StackProps {
    supermanDeploymentGroup: codedeploy.EcsDeploymentGroup;
    supermanCodeBuild: codebuild.Project;
}

export class CodePipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: CodePipelineStackProps) {
        super(scope, id, props);
        const { supermanDeploymentGroup, supermanCodeBuild } = props;

        const cicdBucket = s3.Bucket.fromBucketName(
            this,
            "ImportedCicdBucket",
            cdk.Fn.importValue("CicdBucketName")
        );

        const artifactBucket = s3.Bucket.fromBucketName(
            this,
            "ImportedArtifactBucket",
            cdk.Fn.importValue("ArtifactBucketName")
        );

        const sourceOutput = new codepipeline.Artifact();

        const buildOutput = new codepipeline.Artifact();

        // codepipeline role
        const pipeline = new codepipeline.Pipeline(this, "Pipeline", {
            pipelineName: "superman-pipeline",
            artifactBucket: artifactBucket,
        });

        pipeline.addStage({
            stageName: "Source",
            actions: [
                new codepipelineActions.S3SourceAction({
                    actionName: "S3Source",
                    bucket: cicdBucket,
                    bucketKey: "cicd.zip",
                    output: sourceOutput,
                }),
            ],
        });

        pipeline.addStage({
            stageName: "Build",
            actions: [
                new codepipelineActions.CodeBuildAction({
                    actionName: "CodeBuild",
                    project: supermanCodeBuild,
                    input: sourceOutput,
                    outputs: [buildOutput],
                }),
            ],
        });

        pipeline.addStage({
            stageName: "Deploy",
            actions: [
                new codepipelineActions.CodeDeployEcsDeployAction({
                    actionName: "Deploy",
                    deploymentGroup: supermanDeploymentGroup,
                    appSpecTemplateInput: buildOutput,
                    taskDefinitionTemplateInput: buildOutput,
                }),
            ],
        });
    }
}
