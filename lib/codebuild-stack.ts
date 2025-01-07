import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";

export class CodeBuildStack extends cdk.Stack {
    public readonly supermanCodeBuild: codebuild.Project;

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        const { env: { account = "", region = "" } = {} } = props;

        const cicdBucket = s3.Bucket.fromBucketName(
            this,
            "ImportedCicdBucket",
            cdk.Fn.importValue("CicdBucketName")
        );
        // codebuild
        const supermanCodeBuild = this.createCodeBuild(
            "superman-build",
            cicdBucket,
            account,
            region
        );

        this.supermanCodeBuild = supermanCodeBuild;
    }

    private createCodeBuild(
        service: string,
        cicdBucket: s3.IBucket,
        account: string,
        region: string
    ): codebuild.Project {
        const artifactBucket = s3.Bucket.fromBucketName(
            this,
            "ImportedArtifactBucket",
            cdk.Fn.importValue("ArtifactBucketName")
        );
        return new codebuild.Project(this, service, {
            source: codebuild.Source.s3({
                bucket: cicdBucket,
                path: "cicd.zip",
            }),
            role: this.createCodebuildRole(),
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
                computeType: codebuild.ComputeType.SMALL,
            },
            artifacts: codebuild.Artifacts.s3({
                bucket: artifactBucket,
                includeBuildId: true,
            }),
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
            buildSpec:
                codebuild.BuildSpec.fromSourceFilename("cicd/buildspec.yml"),
            projectName: service,
        });
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

        const s3Policy = new iam.Policy(this, "s3Policy", {
            policyName: "s3Policy",
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["s3:*"],
                    resources: ["*"],
                }),
            ],
        });

        codebuildRole.attachInlinePolicy(ecrPolicy);
        codebuildRole.attachInlinePolicy(secretManagerPolicy);
        codebuildRole.attachInlinePolicy(cloudWatchLogsPolicy);
        codebuildRole.attachInlinePolicy(s3Policy);
    }
}
