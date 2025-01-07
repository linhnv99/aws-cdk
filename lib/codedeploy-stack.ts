import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface CodeDeployStackProps extends cdk.StackProps {
    ecsServiceSecurityGroup: ec2.SecurityGroup;
    blueTargetGroup: elbv2.ApplicationTargetGroup;
    greenTargetGroup: elbv2.ApplicationTargetGroup;
    albListener: elbv2.ApplicationListener;
    service: ecs.FargateService;
}

export class CodeDeployStack extends cdk.Stack {
    public readonly ecsDeploymentGroup: codedeploy.EcsDeploymentGroup;

    constructor(scope: Construct, id: string, props: CodeDeployStackProps) {
        super(scope, id, props);
        const { blueTargetGroup, greenTargetGroup, albListener, service } =
            props;

        // codedeploy
        const codedeployApp = new codedeploy.EcsApplication(
            this,
            "EcsCodeDeployApp",
            {
                applicationName: "superman",
            }
        );

        this.ecsDeploymentGroup = new codedeploy.EcsDeploymentGroup(
            this,
            "EcsDeploymentGroup",
            {
                application: codedeployApp,
                deploymentGroupName: "superman-group",
                service: service,
                deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
                blueGreenDeploymentConfig: {
                    blueTargetGroup: blueTargetGroup,
                    greenTargetGroup: greenTargetGroup,
                    listener: albListener,
                },
                autoRollback: {
                    failedDeployment: true,
                },
                role: this.createCodeDeployRole(),
            }
        );
    }

    private createCodeDeployRole(): iam.Role {
        return new iam.Role(this, "AWSCodeDeployRoleForECS", {
            assumedBy: new iam.ServicePrincipal("codedeploy.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    "AWSCodeDeployRoleForECS"
                ),
            ],
        });
    }
}
