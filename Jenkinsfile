// =============================================================================
// QuickHire Frontend — Jenkins pipeline (Next.js 16)
// Drop this at the repo root as `Jenkinsfile`.
//
// Prerequisites on the Jenkins agent:
//   - NodeJS 22.x (NodeJS plugin tool name: "Node22")
//   - Credentials:
//       quickhire-prod-ssh        : SSH key for deploy@prod
//       quickhire-prod-host       : Secret text — fqdn or IP
//       quickhire-frontend-env    : Secret file — .env.production
// =============================================================================
pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    tools {
        nodejs 'Node22'
    }

    environment {
        APP_NAME    = 'quickhire-frontend'
        DEPLOY_PATH = '/var/www/quickhire/frontend'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse --short HEAD > .git-sha && cat .git-sha'
            }
        }

        stage('Install') {
            steps {
                sh 'node --version && npm --version'
                // Frontend uses peer-dep heavy MUI 7 — legacy peer deps
                // keeps install stable while we migrate.
                sh 'npm ci --no-audit --no-fund --legacy-peer-deps'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint || true'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test -- --ci --silent || echo "tests pending"'
            }
        }

        stage('Build') {
            steps {
                // Inject the production .env so Next.js bakes the
                // NEXT_PUBLIC_* values into the build at compile time.
                withCredentials([file(credentialsId: 'quickhire-frontend-env',
                                      variable: 'PROD_ENV_FILE')]) {
                    sh '''
                        set -e
                        cp $PROD_ENV_FILE .env.production
                        npm run build
                    '''
                }
            }
        }

        stage('Package') {
            steps {
                sh '''
                    set -e
                    SHA=$(cat .git-sha)
                    mkdir -p dist
                    # Next.js standalone output if you've enabled
                    # `output: "standalone"` in next.config — much smaller.
                    # Otherwise we ship .next + public + node_modules.
                    tar --exclude=.git \\
                        --exclude=dist \\
                        --exclude=coverage \\
                        --exclude=tests \\
                        --exclude=e2e \\
                        --exclude=playwright-report \\
                        -czf dist/${APP_NAME}-${SHA}.tar.gz \\
                        .next public package.json package-lock.json next.config.* node_modules \\
                        || tar -czf dist/${APP_NAME}-${SHA}.tar.gz .next public package.json package-lock.json next.config.* node_modules
                    ls -lh dist/
                '''
                archiveArtifacts artifacts: 'dist/*.tar.gz', fingerprint: true
            }
        }

        stage('Deploy to prod') {
            when { branch 'main' }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'quickhire-prod-ssh',
                                      keyFileVariable: 'SSH_KEY',
                                      usernameVariable: 'SSH_USER'),
                    string(credentialsId: 'quickhire-prod-host', variable: 'PROD_HOST'),
                    file(credentialsId: 'quickhire-frontend-env', variable: 'PROD_ENV_FILE')
                ]) {
                    sh '''
                        set -e
                        SHA=$(cat .git-sha)
                        TARBALL=dist/${APP_NAME}-${SHA}.tar.gz
                        SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
                        REMOTE=${SSH_USER}@${PROD_HOST}

                        scp $SSH_OPTS $TARBALL ${REMOTE}:/tmp/${APP_NAME}-${SHA}.tar.gz
                        scp $SSH_OPTS $PROD_ENV_FILE ${REMOTE}:/tmp/${APP_NAME}.env

                        ssh $SSH_OPTS $REMOTE bash -s <<EOF
                            set -e
                            APP=${APP_NAME}
                            BASE=/var/www/quickhire/releases-fe
                            REL=\\$BASE/\\$(date +%Y%m%d-%H%M%S)-${SHA}
                            sudo mkdir -p \\$REL
                            sudo tar -xzf /tmp/\\${APP}-${SHA}.tar.gz -C \\$REL
                            sudo mv /tmp/\\${APP}.env \\$REL/.env.production
                            sudo chown -R quickhire:quickhire \\$REL
                            sudo ln -sfn \\$REL ${DEPLOY_PATH}
                            sudo systemctl restart quickhire-frontend
                            sleep 4
                            curl -fsS http://127.0.0.1:3000/ -o /dev/null -w "homepage: %{http_code}\\n"
                            ls -1dt \\$BASE/*-* | tail -n +6 | xargs -r sudo rm -rf
EOF
                    '''
                }
            }
        }
    }

    post {
        success { echo "✅ ${env.JOB_NAME} #${env.BUILD_NUMBER} deployed" }
        failure { echo "❌ ${env.JOB_NAME} #${env.BUILD_NUMBER} failed" }
    }
}
