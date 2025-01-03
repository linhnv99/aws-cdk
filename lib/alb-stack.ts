import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";

interface AlbStackProps extends cdk.StackProps {
    vpc: ec2.Vpc;
    albSecurityGroup: ec2.SecurityGroup;
}

export class AlbStack extends cdk.Stack {

    public readonly blueTargetGroup: elbv2.ApplicationTargetGroup;
    public readonly greenTargetGroup: elbv2.ApplicationTargetGroup;
    public readonly albListener: elbv2.ApplicationListener;

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
        const blueTargetGroup = new elbv2.ApplicationTargetGroup(
            this,
            "BlueTargetGroup",
            {
                vpc,
                port: 80,
                protocol: elbv2.ApplicationProtocol.HTTP,
                targetType: elbv2.TargetType.INSTANCE,
                healthCheck: {
                    path: "/api/v1/health-check",
                },
                targetGroupName: "blue-user-tg",
            }
        );

        const greenTargetGroup = new elbv2.ApplicationTargetGroup(
            this,
            "GreenTargetGroup",
            {
                vpc,
                port: 80,
                protocol: elbv2.ApplicationProtocol.HTTP,
                targetType: elbv2.TargetType.INSTANCE,
                healthCheck: {
                    path: "/api/v1/health-check",
                },
                targetGroupName: "green-user-tg",
            }
        );

        const defaultTargetGroup = new elbv2.ApplicationTargetGroup(
            this,
            "DefaultTargetGroup",
            {
                vpc,
                port: 80,
                protocol: elbv2.ApplicationProtocol.HTTP,
                targetType: elbv2.TargetType.IP,
                healthCheck: {
                    path: "/",
                },
                targetGroupName: "default",
            }
        );

        // listener
        const httpListener = alb.addListener("HttpListener", {
            port: 80,
            open: true,
        });

        httpListener.addTargetGroups("TargetGroupAttachment", {
            targetGroups: [defaultTargetGroup],
        });

        httpListener.addAction("ForwardingAction", {
            action: elbv2.ListenerAction.forward([blueTargetGroup]),
            conditions: [
                elbv2.ListenerCondition.pathPatterns(["/api/*"])
            ],
            priority: 1
        })


        this.blueTargetGroup = blueTargetGroup;
        this.greenTargetGroup = greenTargetGroup;
        this.albListener = httpListener;
    }
}
