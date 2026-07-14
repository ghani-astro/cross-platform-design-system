pluginManagement {
    repositories {
        google()
        mavenCentral()
    }
    plugins {
        id("com.android.library") version "8.9.0"
        id("org.jetbrains.kotlin.android") version "2.2.10"
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "astro-design-tokens"
include(":tokens")
