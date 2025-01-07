import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";

interface CicdStackProps extends cdk.StackProps {
    cicdBucket: s3.Bucket;
    ecsDeploymentGroup: codedeploy.EcsDeploymentGroup;
}

export class CicdStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: CicdStackProps) {
        super(scope, id, props);
        const { cicdBucket, ecsDeploymentGroup } = props;

        // codebuild 
        const supermanCodebuild = this.createCodeBuild("superman-build", props);


        // codedeploy
        // codepipeline


        const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        const sourceOutput = new codepipeline.Artifact();

        const buildOutput = new codepipeline.Artifact();

        // codepipeline role
        const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            pipelineName: 'superman-pipeline',
            artifactBucket: artifactBucket,
        });

        pipeline.addStage({
            stageName: 'Source',
            actions: [
                new codepipelineActions.S3SourceAction({
                    actionName: 'S3Source',
                    bucket: cicdBucket,
                    bucketKey: 'cicd.zip',
                    output: sourceOutput,
                }),
            ],
        })

        pipeline.addStage({
            stageName: 'Build',
            actions: [
                new codepipelineActions.CodeBuildAction({
                    actionName: 'CodeBuild',
                    project: supermanCodebuild,
                    input: sourceOutput,
                    outputs: [buildOutput],
                }),
            ],
        });

        pipeline.addStage({
            stageName: 'Deploy',
            actions: [
                new codepipelineActions.CodeDeployEcsDeployAction({
                    actionName: 'Deploy',
                    deploymentGroup: ecsDeploymentGroup,
                    appSpecTemplateInput: buildOutput,
                    taskDefinitionTemplateInput: buildOutput,
                }),
            ],
        });
    }

    private createCodeBuild(service: string, props: CicdStackProps): codebuild.Project {
        const { cicdBucket, env: { account = "", region = "" } = {} } = props;

        // create role for codebuild
        const codebuildRole = this.createCodebuildRole()

        // create codebuild
        return new codebuild.Project(this, service, {
            source: codebuild.Source.s3({
                bucket: cicdBucket,
                path: "cicd.zip",
            }),
            role: codebuildRole,
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
                computeType: codebuild.ComputeType.SMALL,
            },
            environmentVariables: {
                SERVICE_NAME: {
                    type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                    value: "superman",
                },
                ACCOUNT: {
                    type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                    value: account,
                },
                REGION: {
                    type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
                    value: region,
                },
            },
            buildSpec: codebuild.BuildSpec.fromSourceFilename(
                "cicd/buildspec.yml"
            ),
            projectName: service,
        }
        );
    }


    private createCodebuildRole(): iam.Role {
        const role = new iam.Role(this, "CodebuildRole", {
            assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
        });
        this.attachCodeBuildPolicies(role);
        return role;
    }

    private attachCodeBuildPolicies(codebuildRole: iam.Role): void {
        const ecrPolicy = new iam.Policy(this, "CodeBuildEcrPolicy", {
            policyName: "CodeBuildEcrPolicy",
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "ecr:UntagResource",
                        "ecr:GetDownloadUrlForLayer",
                        "ecr:BatchGetImage",
                        "ecr:CompleteLayerUpload",
                        "ecr:TagResource",
                        "ecr:GetAuthorizationToken",
                        "ecr:UploadLayerPart",
                        "ecr:ListImages",
                        "ecr:InitiateLayerUpload",
                        "ecr:BatchCheckLayerAvailability",
                        "ecr:GetRepositoryPolicy",
                        "ecr:PutImage",
                    ],
                    resources: ["*"],
                }),
            ],
        });

        const secretManagerPolicy = new iam.Policy(
            this,
            "CodeBuildSecretManagerPolicy",
            {
                policyName: "CodeBuildSecretManagerPolicy",
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["secretsmanager:GetSecretValue"],
                        resources: ["*"],
                    }),
                ],
            }
        );

        const cloudWatchLogsPolicy = new iam.Policy(
            this,
            "CloudWatchLogsPolicy",
            {
                policyName: "CloudWatchLogsPolicy",
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["logs:*"],
                        resources: ["*"],
                    }),
                ],
            }
        );

        const s3Policy = new iam.Policy(
            this,
            "s3Policy",
            {
                policyName: "s3Policy",
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["s3:*"],
                        resources: ["*"],
                    }),
                ],
            }
        );

        codebuildRole.attachInlinePolicy(ecrPolicy);
        codebuildRole.attachInlinePolicy(secretManagerPolicy);
        codebuildRole.attachInlinePolicy(cloudWatchLogsPolicy);
        codebuildRole.attachInlinePolicy(s3Policy);
    }
}