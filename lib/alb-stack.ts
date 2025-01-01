import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface AlbStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    albSecurityGroup: ec2.SecurityGroup;
}

export class AlbStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AlbStackProps) {
        super(scope, id, props);

        const { vpc, albSecurityGroup } = props;

        const alb = new elbv2.ApplicationLoadBalancer(this, "alb", {
            vpc,
            internetFacing: true,
            securityGroup: albSecurityGroup,
            loadBalancerName: "NF-ALB",
        });

        // target group
        const targetGroup = new elbv2.ApplicationTargetGroup(
            this,
            "TargetGroup",
            {
                vpc,
                port: 80,
                protocol: elbv2.ApplicationProtocol.HTTP,
                targetType: elbv2.TargetType.INSTANCE,
                healthCheck: {
                    path: "/api/v1/health-check",
                },
                targetGroupName: "user-tg",
            }
        );

        // listener
        const httpListener = alb.addListener("HttpListener", {
            port: 80,
            open: true,
        });

        httpListener.addTargetGroups("TargetGroupAttachment", {
            targetGroups: [targetGroup],
        });
    }
}
