// Review-only Lambda/DynamoDB preparation. Never provisions or enables access.
import { writeFile } from 'node:fs/promises';
const ref = name => ({ Ref: name }), sub = text => ({ 'Fn::Sub': text });
const template = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: 'Lambda-only frontend preparation; closed placeholder until direct ZIP upload/runtime configuration. Existing DynamoDB backend retained.',
  Resources: {
    Role: { Type: 'AWS::IAM::Role', Properties: {
      AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
      Policies: [{ PolicyName: 'frontend-runtime-only', PolicyDocument: { Version: '2012-10-17', Statement: [
        { Effect: 'Allow', Action: 'lambda:InvokeFunction', Resource: sub('arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:jaldrishti-real-backend') },
        { Effect: 'Allow', Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: sub('arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/jaldrishti-frontend:*') },
      ] } }],
    } },
    Frontend: { Type: 'AWS::Lambda::Function', Properties: {
      FunctionName: 'jaldrishti-frontend', Runtime: 'nodejs24.x', Architectures: ['x86_64'], Handler: 'run.sh',
      Role: { 'Fn::GetAtt': ['Role', 'Arn'] }, MemorySize: 512, Timeout: 30,
      Code: { ZipFile: 'exports.handler = async () => { throw new Error("Release not configured"); };' },
      Layers: ['arn:aws:lambda:ap-southeast-2:753240598075:layer:LambdaAdapterLayerX86:30'],
      Environment: { Variables: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap', AWS_LWA_PORT: '8080', AWS_LWA_READINESS_CHECK_PATH: '/',
        NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production',
        JALDRISHTI_BACKEND_FUNCTION_NAME: 'jaldrishti-real-backend',
        JALDRISHTI_FRONTEND_ORIGIN: 'https://pending.invalid',
      } },
    } },
    FrontendUrl: { Type: 'AWS::Lambda::Url', Properties: { TargetFunctionArn: ref('Frontend'), AuthType: 'AWS_IAM', InvokeMode: 'BUFFERED' } },
  },
  Outputs: { FrontendFunction: { Value: ref('Frontend') }, ClosedUrl: { Value: { 'Fn::GetAtt': ['FrontendUrl', 'FunctionUrl'] } } },
};
await writeFile(new URL('./template.json', import.meta.url), JSON.stringify(template, null, 2) + '\n');
await writeFile(new URL('./deployment-plan.json', import.meta.url), JSON.stringify({
  deploy: false, account: process.env.AWS_ACCOUNT_ID ?? 'YOUR_AWS_ACCOUNT_ID', region: 'ap-southeast-2', runtimeServices: ['Lambda', 'DynamoDB'],
  backend: 'jaldrishti-real-backend', table: 'jaldrishti-real-campus-state', transport: 'IAM-signed Lambda Invoke',
  frontendEndpoint: 'HTTPS Lambda Function URL', initialAuthType: 'AWS_IAM',
  browserAuthTypeAfterExplicitPublicAccessApproval: 'NONE with server operator session on all protected endpoints',
  staticAssets: 'Included in Lambda ZIP; no CDN or asset bucket',
  secrets: 'Injected privately into encrypted Lambda runtime environment; never in source/build/plan',
  upload: 'Direct UpdateFunctionCode ZipFile; no S3 release dependency. Enforce compressed 50 MiB and unzipped 250 MiB including layer.',
  linuxBuild: 'Existing or separately approved Linux Node 24 environment; no CodeBuild project or Docker installation planned',
  rollback: 'Retained published Lambda versions, stable alias, previous ZIPs/assets/configuration',
  publicAccess: false,
}, null, 2) + '\n');
console.log('Generated closed Lambda-only frontend template and deployment plan.');
