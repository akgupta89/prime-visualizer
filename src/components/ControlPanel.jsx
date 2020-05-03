import React, { useState } from "react";
import { TextField, Button, Paper, makeStyles } from "@material-ui/core";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "inline-block",
    backgroundColor: "transparent",
    boxShadow: "none",
    position: "absolute",
    left: "10px",
    bottom: "10px",
    "& > *": {
      margin: theme.spacing(1),
      width: "25ch",
    },
  },
}));

export function ControlPanel(props) {
  const classes = useStyles();
  const { canvasState, setCanvasState, resetPosition } = props;
  const { angleDelta, traceRoute } = canvasState;
  const boundValue = (val, min, max) => Math.max(Math.min(val, max), min);
  const callAction = (e) => {
    e.persist();
    return setCanvasState((prevState) => {
      return {
        ...prevState,
        [e.target.name]: boundValue(
          parseFloat(e.target.value),
          e.target.min,
          e.target.max
        ),
      };
    });
  };

  return (
    <Paper className={classes.root}>
      <TextField
        name="angleDelta"
        type="number"
        size="small"
        label="Angle Delta"
        variant="outlined"
        defaultValue={angleDelta}
        onInput={callAction}
        onChange={callAction}
        inputProps={{
          min: "0",
          max: "360",
        }}
      />
      <TextField
        name="traceRoute"
        type="number"
        size="small"
        label="Trace Route"
        variant="outlined"
        defaultValue={traceRoute}
        onInput={callAction}
        onChange={callAction}
        inputProps={{
          min: "0",
          max: "36",
        }}
      />
      <Button
        variant="contained"
        color="secondary"
        onClick={(e) => resetPosition(e, setCanvasState)}
      >
        Recenter
      </Button>
    </Paper>
  );
}
