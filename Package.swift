// swift-tools-version:5.9
// Swift Package manifest for the Astro design tokens iOS library.
// The macOS platform is declared so that swift build works locally on a Mac;
// iOS 15 matches the astro-buyer-ios deployment target.
import PackageDescription

let package = Package(
    name: "AstroDesignTokens",
    platforms: [
        .iOS(.v15),
        .macOS(.v11),
    ],
    products: [
        .library(
            name: "AstroDesignTokens",
            targets: ["AstroDesignTokens"]
        ),
    ],
    targets: [
        .target(
            name: "AstroDesignTokens",
            path: "Sources/AstroDesignTokens"
        ),
    ]
)
