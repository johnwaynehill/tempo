import SwiftUI
import os

/// Port of `CompletionSparkle.tsx`: a small burst of dots from the complete control.
/// Six to eight sage and soft-neutral dots travel 16–30pt outwards, shrink and fade over
/// ~600 ms on an ease-out curve. Place it as an overlay centred on the control and bump
/// `trigger` to fire. With Reduce Motion on nothing renders at all.
struct CompletionSparkle: View {
    /// Fires a burst whenever it changes to a new value (ignored when it goes back to 0/false).
    var trigger: Int

    @Environment(\.accessibilityReduceMotion) private var systemReduceMotion
    @State private var bursts: [Burst] = []

    private var reduceMotion: Bool {
        #if DEBUG
        if Self.debugReduceMotion { return true }
        #endif
        return systemReduceMotion
    }

    var body: some View {
        ZStack {
            ForEach(bursts) { burst in
                ForEach(burst.particles) { particle in
                    SparkleParticle(particle: particle)
                }
            }
        }
        .frame(width: 0, height: 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: trigger) { _, new in
            if new != 0 { fire() }
        }
        #if DEBUG
        .onReceive(NotificationCenter.default.publisher(for: CompletionSparkle.debugNotification)) { _ in
            fire()
        }
        #endif
    }

    private func fire() {
        guard !reduceMotion else {
            Self.log.info("sparkle: skipped (reduce motion)")
            return
        }
        let burst = Burst()
        bursts.append(burst)
        Self.log.info("sparkle: burst \(burst.id.uuidString.prefix(8), privacy: .public) with \(burst.particles.count) dots")
        let lifetime = (Self.duration + 0.1) * Self.timeScale
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(lifetime))
            bursts.removeAll { $0.id == burst.id }
        }
    }

    static let duration: Double = 0.5
    static let log = Logger(subsystem: "com.johnwaynehill.Tempo", category: "sparkle")

    /// Slows the burst down for screenshots (`TEMPO_DEBUG_SPARKLE_SCALE`, DEBUG only).
    static var timeScale: Double {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["TEMPO_DEBUG_SPARKLE_SCALE"], let scale = Double(raw), scale > 0 {
            return scale
        }
        #endif
        return 1
    }

    #if DEBUG
    /// Posting this fires every sparkle on screen (`TEMPO_DEBUG_SPARKLE=1`).
    static let debugNotification = Notification.Name("TempoDebugSparkle")
    /// `TEMPO_DEBUG_REDUCE_MOTION=1` behaves as if Reduce Motion were on; `simctl` can't toggle it.
    static var debugReduceMotion: Bool {
        ProcessInfo.processInfo.environment["TEMPO_DEBUG_REDUCE_MOTION"] == "1"
    }
    #endif
}

private struct Burst: Identifiable {
    let id = UUID()
    let particles: [Particle]

    init() {
        let count = 7
        particles = (0..<count).map { i in
            let angle = (360 / Double(count)) * Double(i) + Double.random(in: -15...15)
            return Particle(
                id: i,
                angle: angle * .pi / 180,
                distance: Double.random(in: 16...30),
                size: Double.random(in: 3...6),
                delay: Double.random(in: 0...0.08),
                neutral: i % 3 == 2
            )
        }
    }
}

private struct Particle: Identifiable {
    let id: Int
    let angle: Double
    let distance: Double
    let size: Double
    let delay: Double
    /// A soft neutral dot among the sage ones.
    let neutral: Bool
}

private struct SparkleParticle: View {
    let particle: Particle
    @State private var launched = false

    var body: some View {
        Circle()
            .fill(particle.neutral ? Theme.outlineVariant : Theme.primary)
            .frame(width: particle.size, height: particle.size)
            .scaleEffect(launched ? 0.1 : 1)
            .opacity(launched ? 0 : 1)
            .offset(
                x: launched ? cos(particle.angle) * particle.distance : 0,
                y: launched ? sin(particle.angle) * particle.distance : 0
            )
            .onAppear {
                let scale = CompletionSparkle.timeScale
                withAnimation(.easeOut(duration: CompletionSparkle.duration * scale).delay(particle.delay * scale)) {
                    launched = true
                }
            }
    }
}
