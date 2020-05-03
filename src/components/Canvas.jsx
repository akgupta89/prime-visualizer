import React from "react";

export class Canvas extends React.Component {
  componentDidMount() {
    const setCanvasState = this.props.setCanvasState;

    if (this.props.canvasRef.current) {
      this.props.canvasRef.current.addEventListener("pointerdown", (e) =>
        this.props.pointerEvent(e, setCanvasState)
      );
      this.props.canvasRef.current.addEventListener("pointermove", (e) =>
        this.props.pointerEvent(e, setCanvasState)
      );
      this.props.canvasRef.current.addEventListener("pointercancel", (e) =>
        this.props.pointerEvent(e, setCanvasState)
      );
      this.props.canvasRef.current.addEventListener("pointerout", (e) =>
        this.props.pointerEvent(e, setCanvasState)
      );
      this.props.canvasRef.current.addEventListener("pointerup", (e) =>
        this.props.pointerEvent(e, setCanvasState)
      );
      this.props.canvasRef.current.addEventListener("wheel", (e) =>
        this.props.updateScale(e, setCanvasState)
      );
      window.addEventListener("resize", (e) =>
        this.props.resetPosition(e, setCanvasState)
      );
    }

    return () => {
      if (this.props.canvasRef.current) {
        this.props.canvasRef.current.removeEventListener("pointerdown", (e) =>
          this.props.pointerEvent(e, setCanvasState)
        );
        this.props.canvasRef.current.removeEventListener("pointermove", (e) =>
          this.props.pointerEvent(e, setCanvasState)
        );
        this.props.canvasRef.current.removeEventListener("pointercancel", (e) =>
          this.props.pointerEvent(e, setCanvasState)
        );
        this.props.canvasRef.current.removeEventListener("pointerout", (e) =>
          this.props.pointerEvent(e, setCanvasState)
        );
        this.props.canvasRef.current.removeEventListener("pointerup", (e) =>
          this.props.pointerEvent(e, setCanvasState)
        );
        this.props.canvasRef.current.removeEventListener("wheel", (e) =>
          this.props.updateScale(e, setCanvasState)
        );
        window.removeEventListener("resize", (e) =>
          this.props.resetPosition(e, setCanvasState)
        );
      }
    };
  }

  // static logText(text) {
  //   document.getElementById("log").innerText = JSON.stringify(text);
  // }

  render() {
    return (
      <canvas
        id="canvas"
        key="static-canvas"
        ref={this.props.canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      ></canvas>
    );
  }
}
