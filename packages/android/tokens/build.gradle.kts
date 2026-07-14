plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("maven-publish")
}

group = "com.astro.design"
version = File(rootDir, "../../VERSION").readText().trim()

android {
    namespace = "com.astro.design.tokens"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // Only Color, Dp and TextUnit data types are used, no composables,
    // so the Compose compiler plugin is not needed.
    api("androidx.compose.ui:ui-graphics:1.7.8")
    api("androidx.compose.ui:ui-unit:1.7.8")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = "com.astro.design"
            artifactId = "tokens"
            version = project.version.toString()
            afterEvaluate {
                from(components["release"])
            }
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/ghani-astro/cross-platform-design-system")
            credentials {
                username = System.getenv("GITHUB_ACTOR") ?: findProperty("gpr.user") as String?
                password = System.getenv("GITHUB_TOKEN") ?: findProperty("gpr.key") as String?
            }
        }
    }
}
