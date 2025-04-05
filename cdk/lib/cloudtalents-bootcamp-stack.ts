import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class CloudtalentsBootcampStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ----------------------------------------------------------------------
    // OIDC Provider
    // ----------------------------------------------------------------------
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // ----------------------------------------------------------------------
    // IAM Policy
    // ----------------------------------------------------------------------
    const policyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'GitHubActionsCDK',
          effect: iam.Effect.ALLOW,
          actions: [
            //vpc
            'ec2:CreateVpc',
            'ec2:DescribeVpcs',
            'ec2:DeleteVpc',
            //subnets
            'ec2:CreateSubnet',
            'ec2:DescribeSubnets',
            'ec2:DeleteSubnet',
            //igw
            'ec2:CreateInternetGateway',
            'ec2:AttachInternetGateway',
            'ec2:AttachInternetGateway',
            'ec2:DetachInternetGateway',
            'ec2:DeleteInternetGateway',
            //route tables
            'ec2:CreateRouteTable',
            'ec2:AssociateRouteTable',
            'ec2:CreateRoute',
            'ec2:DeleteRoute',
            'ec2:DeleteRouteTable',
            //security groups
            'ec2:CreateSecurityGroup',
            'ec2:AuthorizeSecurityGroupIngress',
            'ec2:AuthorizeSecurityGroupEgress',
            'ec2:DeleteSecurityGroup',
            //network acl
            'ec2:CreateNetworkAcl',
            'ec2:CreateNetworkAclEntry',
            'ec2:DeleteNetworkAcl',
            'ec2:DeleteNetworkAclEntry',
          ],
          resources: [`arn:aws:ec2:${this.account}:*`],
        }),
      ],
    });

    const githubPolicy = new iam.ManagedPolicy(this, 'GitHubCdkPolicy', {
      managedPolicyName: 'GitHubCdkPolicy',
      description:
        'Allow read-write access to create CDK resources',
      document: policyDocument,
    });

    // ----------------------------------------------------------------------
    // IAM Role
    // ----------------------------------------------------------------------
    const githubRole = new iam.Role(this, 'GitHubCdkRole', {
      roleName: 'GitHubCdkRole',
      description: 'Role used by GitHub Actions to provision resources via CDK',
      maxSessionDuration: cdk.Duration.hours(2),
      managedPolicies: [githubPolicy],
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': ['sts.amazonaws.com'],
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': ['repo:rickyriosp/cloudtalents-bootcamp:*'],
        },
      }),
    });

    new cdk.CfnOutput(this, 'GitHubCdkRoleOutput', {
      key: 'GitHubCdkRoleName',
      value: githubRole.roleName,
    });

    // ----------------------------------------------------------------------
    // VPC
    // ----------------------------------------------------------------------

    // Create a VPC with public subnets (this auto-creates an IGW)
    const vpc = new ec2.Vpc(this, 'vpc', {
      vpcName: 'vpc-network',
      ipAddresses: ec2.IpAddresses.cidr('172.16.0.0/16'),
      createInternetGateway: true,
      maxAzs: 2, // Default is 3 AZs
      // availabilityZones: ['us-east-1a', 'us-east-1b'], // Not needed if you define maxAzs
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Resources created with the VPC
    console.log(
      'VPC children:',
      vpc.node.children.map((child) => child.node.id),
    );

    // Set the Name tag for the Subnets
    vpc.publicSubnets.forEach((sn, i) => cdk.Tags.of(sn).add('Name', `PublicSubnet${i + 1}`));
    vpc.isolatedSubnets.forEach((sn, i) => cdk.Tags.of(sn).add('Name', `PrivateSubnet${i + 1}`));

    // Access the underlying CfnInternetGateway created by the VPC
    const igw = vpc.node.findChild('IGW') as ec2.CfnInternetGateway;

    // Set the Name tag for the IGW
    cdk.Tags.of(igw).add('Name', 'igw-networkvpc');
  }
}
